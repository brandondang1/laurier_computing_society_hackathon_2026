import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { 
  Pencil, Square, Circle as CircleIcon, Eraser, 
  Hand, MonitorUp, EyeOff, Eye, Trash2, LogOut,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import LandingPage from './components/LandingPage';

const SOCKET_URL = 'http://localhost:8080';
const A4_WIDTH = 794; // ~210mm at 96 DPI
const A4_PAGE_HEIGHT = 1123; // ~297mm at 96 DPI
const A4_HEIGHT = A4_PAGE_HEIGHT * 3; // 3 pages long

let socket;

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [users, setUsers] = useState([]);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  const [isLinked, setIsLinked] = useState(true);
  const [hostCamera, setHostCamera] = useState({ x: 0, y: 0, scale: 1 });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const currentShapeRef = useRef(null);
  const stageRef = useRef(null);
  const layerRef = useRef(null);

  const SIDEBAR_WIDTH = 260;

  const leaveRoom = () => {
    socket.emit('leave_room', roomId);
    setInRoom(false);
    setRoomId('');
    setUsername('');
    setShapes([]);
    setUsers([]);
    setIsHost(false);
  };

  const downloadPDF = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // Save current transform to restore later
    const oldPos = stage.position();
    const oldScale = stage.scaleX();

    // Force stage to identity transform for a clean export
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });

    const pdf = new jsPDF('p', 'px', [A4_WIDTH, A4_PAGE_HEIGHT]);

    try {
      for (let i = 0; i < 3; i++) {
        if (i > 0) pdf.addPage([A4_WIDTH, A4_PAGE_HEIGHT], 'p');
        
        // Capture the exact A4 segment from the stage
        const dataUrl = stage.toDataURL({
          x: 0,
          y: i * A4_PAGE_HEIGHT,
          width: A4_WIDTH,
          height: A4_PAGE_HEIGHT,
          pixelRatio: 2
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, A4_WIDTH, A4_PAGE_HEIGHT);
      }

      pdf.save(`recall-${roomId || 'drawing'}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
    } finally {
      // Restore original view transform
      stage.position(oldPos);
      stage.scale({ x: oldScale, y: oldScale });
      stage.batchDraw();
    }
  };

  const clampCamera = (cam) => {
    let { x, y, scale } = cam;
    const stageWidth = window.innerWidth - SIDEBAR_WIDTH;

    // Minimum scale to fit paper if it's smaller than the stage
    const minScaleX = stageWidth / A4_WIDTH;
    const minScaleY = window.innerHeight / A4_HEIGHT;
    const minScale = Math.min(minScaleX, minScaleY, 1);
    
    if (scale < minScale) scale = minScale;

    const maxScale = 5;
    if (scale > maxScale) scale = maxScale;

    const minX = stageWidth - A4_WIDTH * scale;
    const minY = window.innerHeight - A4_HEIGHT * scale;

    // If paper is smaller than stage, center it
    if (A4_WIDTH * scale <= stageWidth) {
      x = (stageWidth - A4_WIDTH * scale) / 2;
    } else {
      x = Math.max(minX, Math.min(0, x));
    }

    if (A4_HEIGHT * scale <= window.innerHeight) {
      y = (window.innerHeight - A4_HEIGHT * scale) / 2;
    } else {
      y = Math.max(minY, Math.min(0, y));
    }

    return { x, y, scale };
  };

  useEffect(() => {
    socket = io(SOCKET_URL);

    socket.on('room_state', (state) => {
      setShapes(state.shapes);
      setIsHost(state.isHost);
      setUsers(state.users || []);
      const clampedHostCam = clampCamera(state.camera);
      setHostCamera(clampedHostCam);
      if (state.isHost || isLinked) {
        setCamera(clampedHostCam);
      }
    });

    socket.on('room_users', (userList) => {
      setUsers(userList);
    });

    socket.on('host_changed', (data) => {
      setIsHost(socket.id === data.hostId);
    });

    socket.on('new_shape', (shape) => {
      setShapes((prev) => [...prev, shape]);
    });

    socket.on('shape_updated', (updatedShape) => {
      setShapes((prev) =>
        prev.map((shape) => (shape.id === updatedShape.id ? updatedShape : shape))
      );
    });

    socket.on('camera_updated', (cam) => {
      setHostCamera(clampCamera(cam));
    });

    socket.on('canvas_cleared', () => {
      setShapes([]);
    });

    socket.on('host_left', () => {
      console.log('Host left the room');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isHost && isLinked) {
      setCamera(hostCamera);
    }
  }, [hostCamera, isLinked, isHost]);

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
      socket.emit('join_room', { roomId: roomId.trim(), username: username.trim() });
      setInRoom(true);
    }
  };

  const emitCamera = (cam) => {
    if (isHost) {
      socket.emit('update_camera', { roomId, camera: cam });
    }
  };

  const getRelativePointerPosition = (stage) => {
    const pointer = stage.getPointerPosition();
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    if (!isHost && isLinked) setIsLinked(false);

    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const newPos = {
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    };

    const newCam = clampCamera({ x: newPos.x, y: newPos.y, scale: newScale });
    setCamera(newCam);
    emitCamera(newCam);
  };

  const handleDragStart = (e) => {
    if (e.target === e.target.getStage()) {
      if (!isHost && isLinked) setIsLinked(false);
    }
  };

  const handleDragMove = (e) => {
    if (e.target === e.target.getStage()) {
      const newCam = clampCamera({ x: e.target.x(), y: e.target.y(), scale: camera.scale });
      setCamera(newCam);
      emitCamera(newCam);
    }
  };

  const handleMouseDown = (e) => {
    if (!isHost) return;
    if (tool === 'pan') return;

    const pos = getRelativePointerPosition(e.target.getStage());
    
    // Only allow drawing within A4 bounds
    if (pos.x < 0 || pos.x > A4_WIDTH || pos.y < 0 || pos.y > A4_HEIGHT) return;

    setIsDrawing(true);
    
    const newShape = {
      id: uuidv4(),
      type: tool,
      color: tool === 'eraser' ? '#ffffff' : color, // background is white now
      strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
    };

    if (tool === 'pencil' || tool === 'eraser') {
      newShape.points = [pos.x, pos.y];
    } else if (tool === 'rect') {
      newShape.x = pos.x;
      newShape.y = pos.y;
      newShape.width = 0;
      newShape.height = 0;
    } else if (tool === 'circle') {
      newShape.x = pos.x;
      newShape.y = pos.y;
      newShape.radius = 0;
    }

    currentShapeRef.current = newShape;
    setShapes((prev) => [...prev, newShape]);
    socket.emit('draw_shape', { roomId, shape: newShape });
  };

  const handleMouseMove = (e) => {
    if (!isHost || !isDrawing || !currentShapeRef.current) return;

    const pos = getRelativePointerPosition(e.target.getStage());
    const id = currentShapeRef.current.id;

    // Clamp drawing coordinates to paper bounds
    const clampedX = Math.max(0, Math.min(A4_WIDTH, pos.x));
    const clampedY = Math.max(0, Math.min(A4_HEIGHT, pos.y));

    const shape = currentShapeRef.current;
    const updated = { ...shape };

    if (shape.type === 'pencil' || shape.type === 'eraser') {
      updated.points = [...(shape.points || []), clampedX, clampedY];
    } else if (shape.type === 'rect') {
      updated.width = clampedX - (shape.x || 0);
      updated.height = clampedY - (shape.y || 0);
    } else if (shape.type === 'circle') {
      const dx = clampedX - (shape.x || 0);
      const dy = clampedY - (shape.y || 0);
      updated.radius = Math.sqrt(dx * dx + dy * dy);
    }

    currentShapeRef.current = updated;

    setShapes((prev) =>
      prev.map((s) => (s.id === id ? updated : s))
    );

    socket.emit('update_shape', { roomId, shape: updated });
  };

  const handleMouseUp = () => {
    if (!isHost || !isDrawing || !currentShapeRef.current) return;
    setIsDrawing(false);
    
    socket.emit('update_shape', { roomId, shape: currentShapeRef.current });
    currentShapeRef.current = null;
  };

  const clearCanvas = () => {
    if (isHost) {
      socket.emit('clear_canvas', roomId);
      setShapes([]);
    }
  };

  if (!inRoom) {
    return (
      <LandingPage 
        roomId={roomId} 
        setRoomId={setRoomId} 
        username={username}
        setUsername={setUsername}
        joinRoom={joinRoom} 
      />
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-200 flex overflow-hidden">
      {/* Main Drawing Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toolbar */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-md flex items-center gap-4 z-10 border border-gray-200">
          <div className="flex items-center gap-2 border-r pr-4 border-gray-300">
            <span className={`text-sm font-semibold px-2 py-1 rounded ${isHost ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              {isHost ? 'Host' : 'Viewer'}
            </span>
          </div>

          {isHost ? (
            <>
              <button onClick={() => setTool('pan')} className={`p-2 rounded ${tool === 'pan' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Pan"><Hand size={20}/></button>
              <button onClick={() => setTool('pencil')} className={`p-2 rounded ${tool === 'pencil' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Pencil"><Pencil size={20}/></button>
              <button onClick={() => setTool('rect')} className={`p-2 rounded ${tool === 'rect' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Rectangle"><Square size={20}/></button>
              <button onClick={() => setTool('circle')} className={`p-2 rounded ${tool === 'circle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Circle"><CircleIcon size={20}/></button>
              <button onClick={() => setTool('eraser')} className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Eraser"><Eraser size={20}/></button>
              
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 cursor-pointer rounded" title="Color" />
              <input type="range" min="1" max="20" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24" title="Stroke Width" />
              
              <button onClick={clearCanvas} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Clear Canvas"><Trash2 size={20}/></button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsLinked(!isLinked)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${isLinked ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {isLinked ? <Eye size={18}/> : <EyeOff size={18}/>}
                {isLinked ? 'Linked to Host View' : 'Detached View'}
              </button>
              {!isLinked && (
                <button 
                  onClick={() => {
                    setCamera(hostCamera);
                    setIsLinked(true);
                  }}
                  className="text-sm flex items-center gap-1 text-gray-600 hover:text-gray-900"
                >
                  <MonitorUp size={16}/> Sync
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 cursor-crosshair relative">
          <Stage
            ref={stageRef}
            width={window.innerWidth - SIDEBAR_WIDTH}
            height={window.innerHeight}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            draggable={isHost ? tool === 'pan' : true}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            x={camera.x}
            y={camera.y}
            scaleX={camera.scale}
            scaleY={camera.scale}
          >
            <Layer ref={layerRef}>
              <Rect 
                 x={0} y={0} width={A4_WIDTH} height={A4_HEIGHT} 
                 fill="#ffffff" 
                 shadowBlur={10}
                 shadowColor="rgba(0,0,0,0.2)"
                 listening={false} 
              />
              {/* A4 Border */}
              <Rect 
                 x={0} y={0} width={A4_WIDTH} height={A4_HEIGHT} 
                 stroke="#cbd5e1"
                 strokeWidth={1}
                 listening={false} 
              />

              {/* Page Separators */}
              <Line
                points={[0, A4_PAGE_HEIGHT, A4_WIDTH, A4_PAGE_HEIGHT]}
                stroke="#e2e8f0"
                strokeWidth={2}
                dash={[10, 5]}
                listening={false}
              />
              <Line
                points={[0, A4_PAGE_HEIGHT * 2, A4_WIDTH, A4_PAGE_HEIGHT * 2]}
                stroke="#e2e8f0"
                strokeWidth={2}
                dash={[10, 5]}
                listening={false}
              />

              {shapes.map((shape) => {
                if (shape.type === 'pencil' || shape.type === 'eraser') {
                  return (
                    <Line
                      key={shape.id}
                      points={shape.points}
                      stroke={shape.type === 'eraser' ? '#ffffff' : shape.color}
                      strokeWidth={shape.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation="source-over"
                    />
                  );
                } else if (shape.type === 'rect') {                  return (
                    <Rect
                      key={shape.id}
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                    />
                  );
                } else if (shape.type === 'circle') {
                  return (
                    <Circle
                      key={shape.id}
                      x={shape.x}
                      y={shape.y}
                      radius={shape.radius}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                    />
                  );
                }
                return null;
              })}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[260px] bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl flex-shrink-0 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"></path><path d="m18 13-1.5-7.5L2 2l5.5 14.5L13 18l5-5z"></path><path d="m2 2 7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Recall</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={downloadPDF}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
              title="Save as PDF"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={leaveRoom}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
              title="Leave Room"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="mb-8">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block text-left">
              Session Info
            </label>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1 font-medium text-left uppercase">Room ID</div>
              <div className="text-lg font-mono font-bold text-blue-600 break-all text-left leading-tight">{roomId}</div>
            </div>
          </div>

          <div className="mb-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block text-left">
              Participants ({users.length})
            </label>
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${
                    user.id === socket?.id ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-slate-400'
                  }`}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 items-start overflow-hidden">
                    <span className={`text-sm font-semibold truncate w-full text-left ${user.id === socket?.id ? 'text-blue-600' : 'text-slate-700'}`}>
                      {user.username} {user.id === socket?.id && '(You)'}
                    </span>
                    {user.id === users[0]?.id && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter leading-none bg-amber-50 px-1 rounded">Host</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-tighter text-center">
          Built for LCS Hackathon
        </div>
      </div>
    </div>
  );
}
