import { useState, useRef, useEffect } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva';
import { socket } from './socket';
import './App.css'

const App = () => {
  const [tool, setTool] = useState('pen');
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const [color, setColor] = useState('red');
  const [redo, setRedo] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onLineDrawn(value) {
      setLines((prevLines) => {
        const index = prevLines.findIndex((l) => l.id === value.id);
        if (index !== -1) {
          const newLines = [...prevLines];
          newLines[index] = value;
          return newLines;
        }
        return [...prevLines, value];
      });
    }

    function onUndo(lineToRemove) {
      if (!lineToRemove) return;
      setLines(prevLines => prevLines.filter(l => l.id !== lineToRemove.id));
      setRedo(prevRedo => [...prevRedo, lineToRemove]);
    }

    function onRedo(lineToRestore) {
      if (!lineToRestore) return;
      setRedo(prevRedo => prevRedo.filter(l => l.id !== lineToRestore.id));
      setLines(prevLines => [...prevLines, lineToRestore]);
    }

    function onClear() {
      setLines([]);
      setRedo([]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('line', onLineDrawn);
    socket.on('undo', onUndo);
    socket.on('redo', onRedo);
    socket.on('clear', onClear);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('line', onLineDrawn);
      socket.off('undo', onUndo);
      socket.off('redo', onRedo);
      socket.off('clear', onClear);
    };
  }, []);

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const newLine = { 
      id: Date.now().toString(36) + Math.random().toString(36).substring(2), 
      tool, 
      points: [pos.x, pos.y], 
      color 
    };
    setLines([...lines, newLine]);
    setRedo([]);
    socket.emit('line', newLine);
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    // replace last
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
    socket.emit('line', lines[lines.length - 1]);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleColor = (e) => {
    setColor(e.target.value)
  };

  const clearBoard = () => {
    setLines([]);
    setRedo([]);
    socket.emit('clear');
  };

  const handleUndo = () => {
    if (lines.length == 0) return;
    const lineToRemove = lines[lines.length - 1];
    setRedo(prevLines => [...prevLines, lineToRemove]);
    setLines(prevLines => prevLines.slice(0, prevLines.length - 1));
    socket.emit('undo', lineToRemove);
  };

  const handleRedo = () => {
    if (redo.length == 0) return;
    const lineToRestore = redo[redo.length - 1];
    setLines(prevLines => [...prevLines, lineToRestore]);
    setRedo(prevLines => prevLines.slice(0, prevLines.length - 1));
    socket.emit('redo', lineToRestore);
  }

  return (
     <div>
      <select
        value={tool}
        onChange={(e) => {
          setTool(e.target.value);
        }}
      >
        <option value="pen">Pen</option>
        <option value="eraser">Eraser</option>
      </select>


      <input
      type="color"
      id="colorPicker"
      value={color}
      onChange={handleColor}
      />

      <button
      id="clearButton"
      onClick={clearBoard}
      >
      Clear Board
      </button>

      <button
      id="undoButton"
      onClick={handleUndo}
      >
      Undo
      </button>

      <button
      id="redoButton"
      onClick={handleRedo}
      >
      Redo
      </button>


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
          <Text text="Just start drawing" x={5} y={30} />
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.color}
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
