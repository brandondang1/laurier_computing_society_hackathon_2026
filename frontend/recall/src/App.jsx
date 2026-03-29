import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { 
  Pencil, Square, Circle as CircleIcon, Eraser, 
  Hand, MonitorUp, EyeOff, Eye, Trash2 
} from 'lucide-react';
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
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  const [isLinked, setIsLinked] = useState(true);
  const [hostCamera, setHostCamera] = useState({ x: 0, y: 0, scale: 1 });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const currentShapeRef = useRef(null);

  const clampCamera = (cam) => {
    let { x, y, scale } = cam;

    // Minimum scale to fit paper if it's smaller than the window
    const minScaleX = window.innerWidth / A4_WIDTH;
    const minScaleY = window.innerHeight / A4_HEIGHT;
    const minScale = Math.min(minScaleX, minScaleY, 1);
    
    if (scale < minScale) scale = minScale;

    const maxScale = 5;
    if (scale > maxScale) scale = maxScale;

    const minX = window.innerWidth - A4_WIDTH * scale;
    const minY = window.innerHeight - A4_HEIGHT * scale;

    // If paper is smaller than window, center it
    if (A4_WIDTH * scale <= window.innerWidth) {
      x = (window.innerWidth - A4_WIDTH * scale) / 2;
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
      const clampedHostCam = clampCamera(state.camera);
      setHostCamera(clampedHostCam);
      if (state.isHost || isLinked) {
        setCamera(clampedHostCam);
      }
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
    <div className="relative w-full h-screen bg-gray-200 flex flex-col overflow-hidden">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-md flex items-center gap-4 z-10 border border-gray-200">
        
        <div className="flex items-center gap-2 border-r pr-4 border-gray-300">
          <span className={`text-sm font-semibold px-2 py-1 rounded ${isHost ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
            {isHost ? 'Host' : 'Viewer'}
          </span>
          <span className="text-gray-500 text-sm">Room: {roomId}</span>
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
          <div className="flex items-center gap-3 pl-2">
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

      <div className="flex-1 cursor-crosshair">
        <Stage
          width={window.innerWidth}
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
          <Layer>
            {/* A4 Paper Background */}
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
            
            {shapes.map((shape) => {
              if (shape.type === 'pencil' || shape.type === 'eraser') {
                return (
                  <Line
                    key={shape.id}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={shape.type === 'eraser' ? 'destination-out' : 'source-over'}
                  />
                );
              } else if (shape.type === 'rect') {
                return (
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
  );
}
