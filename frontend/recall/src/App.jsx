import { useState, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva';
import './App.css'



const App = () => {
  const [tool, setTool] = useState('pen');
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const [color, setColor] = useState('red');
  const [redo, setRedo] = useState([]);
  const stageRef = useRef(null);
  const [strokeWidth, setStrokeWidth] = useState(5)
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1});
  const [hostCamera, setHostCamera] = useState({ x: 0, y: 0, scale: 1});

  const handleMouseDown = (e) => {
    if (tool === 'grab') return;
    
    isDrawing.current = true;
    const pos = e.target.getStage().getRelativePointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y], color, strokeWidth}]);
    setRedo([]);
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getRelativePointerPosition();
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
    if (redo.length == 0) return;

    setLines (prevLines => [...prevLines, redo[redo.length - 1]]);

    setRedo (prevLines => prevLines.slice(0, prevLines.length -1));
  }

  const handleWheel = (e) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let direction = e.evt.deltaY > 0 ? 1 : -1;

    if (e.evt.ctrlKey){
      direction = -direction;
    }

    const scaleBy = 1.01;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale});

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);

    setCamera({ x: newPos.x, y: newPos.y, scale: newScale})
  };

  const snapCameraBack = () => {
    const stage = stageRef.current;
    stage.position({ x: 0, y: 0});
  }

  const handleDragEnd = (e) => {
    setCamera({ x: e.target.x(), y: e.target.y(), scale: e.target.scaleX()});
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
        <option value="grab">Grab</option>
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

      <input 
      type="range" 
      min="1" 
      max="20" 
      value={strokeWidth} 
      onChange={(e) => setStrokeWidth(Number(e.target.value))}/>

      <button
      id="snapButton"
      onClick={snapCameraBack}
      >
      Snap Camera
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
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        draggable={tool === 'grab'}
        ref={stageRef}
      >
        <Layer>
          <Text text="Just start drawing" x={5} y={30} />
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
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
