import { useEffect, useState, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva';
import { io } from 'socket.io-client';
import './App.css'

// Connect to the backend server
const socket = io('http://localhost:8080');

const App = () => {
  const [tool, setTool] = useState('pen');
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);

  // Listen for drawing events from other users
  useEffect(() => {
    const handleRemoteDraw = (newLine) => {
      setLines((prevLines) => {
        const index = prevLines.findIndex((l) => l.id === newLine.id);
        if (index !== -1) {
          // Update existing line
          const newLines = [...prevLines];
          newLines[index] = newLine;
          return newLines;
        } else {
          // Add new line from another user
          return [...prevLines, newLine];
        }
      });
    };

    socket.on('draw', handleRemoteDraw);
    
    // Initial board state from the server
    const handleInitState = (state) => setLines(state);
    socket.on('init-state', handleInitState);

    // Listen for clear events
    const handleRemoteClear = () => setLines([]);
    socket.on('clear', handleRemoteClear);

    return () => {
      socket.off('draw', handleRemoteDraw);
      socket.off('init-state', handleInitState);
      socket.off('clear', handleRemoteClear);
    };
  }, []);

  const handleClear = () => {
    setLines([]);
    socket.emit('clear');
  };

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    
    // Create a unique ID for this stroke
    const newLine = { 
      id: `${socket.id}-${Date.now()}`, 
      tool, 
      points: [pos.x, pos.y] 
    };
    
    setLines((prev) => [...prev, newLine]);
    socket.emit('draw', newLine);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    setLines((prevLines) => {
      const lastLine = { ...prevLines[prevLines.length - 1] };
      lastLine.points = lastLine.points.concat([point.x, point.y]);

      const updatedLines = [...prevLines];
      updatedLines[prevLines.length - 1] = lastLine;
      
      // Emit the updated line to others
      socket.emit('draw', lastLine);
      return updatedLines;
    });
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div className="whiteboard-container">
      <div className="controls">
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value)}
        >
          <option value="pen">Pen</option>
          <option value="eraser">Eraser</option>
        </select>
        <button onClick={handleClear}>Clear Board</button>
      </div>
      
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          <Text text="Collaborative Whiteboard - Just start drawing!" x={10} y={10} />
          {lines.map((line, i) => (
            <Line
              key={line.id || i}
              points={line.points}
              stroke="#df4b26"
              strokeWidth={5}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                line.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

export default App

