import { useState, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva';
import './App.css'

const App = () => {
  const [tool, setTool] = useState('pen');
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const [color, setColor] = useState('red');
  const [redo, setRedo] = useState([]);

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y], color}]);
    setRedo([]);
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
  };


  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleColor = (e) => {
    setColor(e.target.value)
  };

  const clearBoard = () => {
    setLines([])
  };

  const handleUndo = () => {
    if (lines.length == 0) return;

    setRedo(prevLines => [...prevLines, lines[lines.length - 1]]);

    setLines(prevLines => prevLines.slice(0, prevLines.length - 1));

  };

  const handleRedo = () => {
    if (length.redo == 0) return;

    setLines (prevLines => [...prevLines, redo[redo.length - 1]]);

    setRedo (prevLines => prevLines.slice(0, prevLines.length -1));
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
