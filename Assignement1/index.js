var gl;
var color;
var matrixStack = [];
var animation;
let degreeSun = 0;
let degreeWindMill = 0;
let degreeBird = 0;

let boatX = 0;
let speed = 0.005;
const MAX_X = 0.7; // for boat
const MIN_X = -0.7; // for boat
const epsilon = 0.001; // to change the direction of boat
const MAX_Q = 30; //for bird
const MIN_Q = -10; // for bird;
let flapSpeed = 1;

// mMatrix is called the model matrix, transforms objects
// from local object space to world space.
var mMatrix = mat4.create();
var uMMatrixLocation;

var sqVertexPositionBuffer;
var sqVertexIndexBuffer;

var crVertexPositionBuffer;
var crVertexIndexBuffer;

var aPositionLocation;
var uColorLoc;

let display = 3;

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
  gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
  gl_PointSize = 5.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
  fragColor = color;
}`;

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function initLine(){
  const vertices = new Float32Array([
    -0.5, 0.0, 0.5, 0.0,
  ]);
  lineBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  lineBuf.itemSize = 2;
  lineBuf.numItems = 2;
}

function drawLine(mMatrix, colors = [0.0, 0.0, 0.0, 1.0], width = 1.0){
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    lineBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform4fv(uColorLoc, colors);
  gl.lineWidth(width);
  if(display == 1)
    gl.drawArrays(gl.POINTS, 0, lineBuf.numItems);
  else
    gl.drawArrays(gl.LINES, 0, lineBuf.numItems);
  gl.lineWidth(1.0);
}

function initCircleBuffer(numSegments) {
  // buffer for point locations
  const crVertices = new Float32Array(numSegments * 2 + 2); // Allocate space for all vertices

  crVertices[0] = 0; // Center x-coordinate
  crVertices[1] = 0; // Center y-coordinate

  const radius = 0.5;
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * 2 * Math.PI;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    const vertexIndex = (i + 1) * 2; // Skip the first two positions reserved for center
    crVertices[vertexIndex] = x;
    crVertices[vertexIndex + 1] = y;
  }

  crVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, crVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, crVertices, gl.STATIC_DRAW);
  crVertexPositionBuffer.itemSize = 2;
  crVertexPositionBuffer.numItems = numSegments + 1;

  // buffer for point indices
  const crIndices = new Uint16Array(numSegments * 3); // Allocate space for all indices
  for (let i = 1; i <= numSegments; i++) {
    const index = (i - 1) * 3; // Calculate index position for each group of 3 indices

    crIndices[index] = 0;
    crIndices[index + 1] = i;
    crIndices[index + 2] = (i % numSegments) + 1;
  }

  crVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, crVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, crIndices, gl.STATIC_DRAW);
  crVertexIndexBuffer.itemsize = 1;
  crVertexIndexBuffer.numItems = 3 * numSegments;
}

function drawCircle(mMatrix, colors = [0.0, 0.0, 1.0, 1.0]) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, crVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    crVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, crVertexIndexBuffer);

  gl.uniform4fv(uColorLoc, colors);

  let primitiveType = gl.TRIANGLE_FAN;
  if (display == 3) primitiveType = gl.TRIANGLE_FAN;
  else if (display == 2) primitiveType = gl.LINE_LOOP;
  else primitiveType = gl.POINTS;

  // now draw the square
  gl.drawElements(
    primitiveType,
    crVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;

  // buffer for point indices
  const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sqVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
  sqVertexIndexBuffer.itemsize = 1;
  sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(mMatrix, colors = [0.0, 1.0, 0.0, 1.0]) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

  gl.uniform4fv(uColorLoc, colors);

  // now draw the square
  let primitiveType = gl.TRIANGLES;
  if (display == 3) primitiveType = gl.TRIANGLES;
  else if (display == 2) primitiveType = gl.LINE_LOOP;
  else primitiveType = gl.POINTS;
  gl.drawElements(
    primitiveType,
    sqVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

function initTriangleBuffer() {
  // buffer for point locations
  const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
  triangleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
  triangleBuf.itemSize = 2;
  triangleBuf.numItems = 3;

  // buffer for point indices
  const triangleIndices = new Uint16Array([0, 1, 2]);
  triangleIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
  triangleIndexBuf.itemsize = 1;
  triangleIndexBuf.numItems = 3;
}

function drawTriangle(mMatrix, colors = [1.0, 0.0, 0.0, 1.0]) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    triangleBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);

  gl.uniform4fv(uColorLoc, colors);

  let primitiveType = gl.TRIANGLES;
  if (display == 3) primitiveType = gl.TRIANGLES;
  else if (display == 2) primitiveType = gl.LINE_LOOP;
  else primitiveType = gl.POINTS;

  gl.drawElements(
    primitiveType,
    triangleIndexBuf.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

////////////////////////////////////////////////////////////////////////
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  
  if (animation) {
    window.cancelAnimationFrame(animation);
  }
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  var animate = function(){
    mat4.identity(mMatrix);

    // blue sky
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, 0.5, 0]);
    mat4.scale(mMatrix, [2, 1, 1]);
    drawSquare(mMatrix, [0.35, 0.77, 1, 1]);
    mMatrix = popMatrix(matrixStack);

    //Mountains
    pushMatrix(matrixStack, mMatrix);

    mat4.translate(mMatrix, [0, -0.09, 1])
    mat4.scale(mMatrix, [1.2, 1, 1]);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0.75, 0.1, 0]);
    mat4.scale(mMatrix, [1.5, 0.4, 1]);
    drawTriangle(mMatrix, [0.55, 0.42, 0.28, 1]);
    mMatrix = popMatrix(matrixStack);

    mat4.translate(mMatrix, [-0.7, 0.3, 0]);
    mat4.scale(mMatrix, [0.5, 0.4, 1]);
    for(let i = 0; i < 2; i++){
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [0, -0.5, 0]);
      mat4.scale(mMatrix, [2, 1, 1]);
      drawTriangle(mMatrix, [0.46, 0.31, 0.22, 1]);
      mMatrix = popMatrix(matrixStack);

      pushMatrix(matrixStack, mMatrix);
      mat4.rotateZ(mMatrix, degToRad(15));
      mat4.translate(mMatrix, [0, -0.5, 0]);
      mat4.scale(mMatrix, [2, 1, 1]);
      drawTriangle(mMatrix, [0.55, 0.42, 0.28, 1]);
      mMatrix = popMatrix(matrixStack);
      mat4.scale(mMatrix, [2, 2, 1]);
      mat4.translate(mMatrix , [0.7, 0.2, 0]);
    }

    mMatrix = popMatrix(matrixStack);


    //green background
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -0.5, 0]);
    mat4.scale(mMatrix, [2, 1, 1]);
    drawSquare(mMatrix, [0, 0.88, 0.45, 1]);
    mMatrix = popMatrix(matrixStack);
    
    //sun 
    degreeSun = (degreeSun+0.4)%360;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-0.8, 0.8, 0]);
    mat4.rotateZ(mMatrix, degToRad(degreeSun));
    mat4.scale(mMatrix, [0.5, 0.5, 1]);
    drawSun();
    mMatrix = popMatrix(matrixStack);

    //cloud
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-0.8, 0.45, 0]);
    mat4.scale(mMatrix, [0.25, 0.25, 1]);
    drawClouds();
    mMatrix = popMatrix(matrixStack);

    //Trees
    pushMatrix(matrixStack, mMatrix);

    mat4.translate(mMatrix, [0.8, 0.18, 0]);
    mat4.scale(mMatrix, [0.2, 0.2, 1]);
    drawTree();
    mat4.translate(mMatrix, [-1, 0.38, 0]);
    mat4.scale(mMatrix, [1.2, 1.4, 1]);
    drawTree();
    mat4.translate(mMatrix, [-1, -0.2, 0]);
    mat4.scale(mMatrix, [0.8, 0.8, 1]);
    drawTree();
    mMatrix = popMatrix(matrixStack);

    //Path

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0.5, -0.85, 0]);
    mat4.scale(mMatrix, [2.5, 2, 1]);
    mat4.rotateZ(mMatrix, degToRad(35));
    drawTriangle(mMatrix, [0.36, 0.66, 0.17, 1]);
    mMatrix = popMatrix(matrixStack);
    
    //river
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -0.17, 0]);
    mat4.scale(mMatrix, [2, 0.3, 1]);
    drawSquare(mMatrix, [0, 0.35, 1, 1]);
    mMatrix = popMatrix(matrixStack);
    
    //tides
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.5, 1, 1]);
    mat4.translate(mMatrix, [1.2, -0.27, 0])
    drawLine(mMatrix, [1, 1, 1, 1]);
    mat4.translate(mMatrix, [-1.2, 0.2, 0]);
    drawLine(mMatrix, [1, 1, 1, 1]);
    mat4.translate(mMatrix, [-1.4, -0.1, 0]);
    drawLine(mMatrix, [1, 1, 1, 1]);
    mMatrix = popMatrix(matrixStack);
    
    //boat
    boatX += speed;
    if (Math.abs(boatX - MAX_X) < epsilon) {
        speed = -0.005;
    } else if (Math.abs(boatX - MIN_X) < epsilon) {
        speed = 0.005;
    }
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [boatX, 0, 0]);
    mat4.scale(mMatrix, [0.35, 0.35, 1.0]);
    drawBoat();
    mMatrix = popMatrix(matrixStack);

    //windmills
    degreeWindMill = (degreeWindMill - 1.5)%360;
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.25, 0.25, 1.0]);
    mat4.translate(mMatrix, [-2, 0.2, 0]);
    drawWindMill();
    mat4.translate(mMatrix, [4.5, 0, 0]);
    drawWindMill();
    mMatrix = popMatrix(matrixStack);

    //birds

    degreeBird = degreeBird + flapSpeed;
    if(degreeBird > MAX_Q || degreeBird < MIN_Q)
      flapSpeed = -flapSpeed;
     
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.04, 0.04, 1.0]);
    mat4.translate(mMatrix, [1.5, 15.5, 0]);
    drawBird();
    drawBird();
    mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    mat4.translate(mMatrix, [-8.5, 2, 0]);
    drawBird();
    mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    mat4.translate(mMatrix, [20.5, 2, 0]);
    drawBird();
    mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    mat4.translate(mMatrix, [-14.5, 5, 0]);
    drawBird();
    mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    mat4.translate(mMatrix, [8.5, 3, 0]);
    drawBird();
    mMatrix = popMatrix(matrixStack);

    //bushes
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mat4.translate(mMatrix, [-4.4, -2.8, 0]);
    drawBushes();
    mat4.scale(mMatrix, [1.2, 1.2, 1]);
    mat4.translate(mMatrix, [2.6, 0.2, 0]);
    drawBushes();
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.3, 0.3, 1.0]);
    mat4.translate(mMatrix, [3.2, -1.5, 0]);
    drawBushes();
    mMatrix = popMatrix(matrixStack);

    //house
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mat4.translate(mMatrix, [-3, -1.6, 0]);
    drawHouse();
    mMatrix = popMatrix(matrixStack);

    //car
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.35, 0.35, 1.0]);
    mat4.translate(mMatrix, [-1.6, -2.1, 0]);
    drawCar();
    mMatrix = popMatrix(matrixStack);

    //bush
    pushMatrix(matrixStack, mMatrix);
    mat4.scale(mMatrix, [0.4, 0.4, 1.0]);
    mat4.translate(mMatrix, [-0.4, -2.65, 0]);
    drawBushes();
    mMatrix = popMatrix(matrixStack);

    animation = window.requestAnimationFrame(animate);
  }
  animate();
}

function drawWindMill(){
  pushMatrix(matrixStack, mMatrix);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [0.1, 2, 0]);
  mat4.translate(mMatrix, [0, -0.5, 0.0]);
  drawSquare(mMatrix, [0.18, 0.17, 0.18, 1]);
  mMatrix = popMatrix(matrixStack);

  mat4.rotateZ(mMatrix, degToRad(degreeWindMill));
  for(let i = 0; i < 4; i++){
    mat4.rotateZ(mMatrix, degToRad(90));
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -0.5, 0]);
    mat4.scale(mMatrix, [0.25, 1, 1]);
    drawTriangle(mMatrix, [0.67, 0.66, 0, 1]);
    mMatrix = popMatrix(matrixStack);
  }

  mat4.scale(mMatrix, [0.25, 0.25, 1]);
  drawCircle(mMatrix, [0, 0, 0, 1]);

  mMatrix = popMatrix(matrixStack);
}

function drawBird() {
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [0.5, 0.5, 1]);
  drawSquare(mMatrix, [0, 0, 0, 1]);
  mat4.scale(mMatrix, [2, 2, 1]);

  pushMatrix(matrixStack, mMatrix);
  mat4.rotateZ(mMatrix, degToRad(30 +degreeBird));
  mat4.translate(mMatrix, [2, 0.3, 0]);
  mat4.scale(mMatrix, [4, 0.3, 1]);
  drawTriangle(mMatrix, [0, 0, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.rotateZ(mMatrix, degToRad(-30 - degreeBird));
  mat4.translate(mMatrix, [-2, 0.3, 0]);
  mat4.scale(mMatrix, [4, 0.3, 1]);
  drawTriangle(mMatrix, [0, 0, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  mMatrix = popMatrix(matrixStack);
}

function drawClouds(){
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [2, 1, 1]);
  drawCircle(mMatrix, [1.0, 1.0, 1.0, 1.0]);
  mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
  mat4.translate(mMatrix, [0.5, -0.2, 0]);
  drawCircle(mMatrix, [1.0, 1.0, 1.0, 1.0]);
  mat4.scale(mMatrix, [0.6, 0.7, 1]);
  mat4.translate(mMatrix, [0.9, 0, 0]);
  drawCircle(mMatrix, [1, 1, 1, 1]);

  mMatrix = popMatrix(matrixStack);
}

function drawSun(){
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
  drawCircle(mMatrix, [1.0, 1.0, 0.0, 1.0]);
  mat4.scale(mMatrix, [1.5, 1.5, 1]);

  for(let i = 0; i < 4; i++){
    mat4.rotateZ(mMatrix, degToRad(45));
    drawLine(mMatrix, [1.0, 1.0, 0.0, 1.0]);
  }

  mMatrix = popMatrix(matrixStack);
}

function drawTree() {
  pushMatrix(matrixStack, mMatrix);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0.0, -0.2, 0.0]);
  mat4.scale(mMatrix, [0.2, 1.5, 1.0]);
  drawSquare(mMatrix, [0.45, 0.27, 0.26, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0., 1, 0.0]);
  mat4.scale(mMatrix, [1.5, 1.2, 1.0]);
  drawTriangle(mMatrix, [0, 0.55, 0.27, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0., 1.25, 0.0]);
  mat4.scale(mMatrix, [1.75, 1.2, 1.0]);
  drawTriangle(mMatrix, [0.26, 0.66, 0.26, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0., 1.5, 0.0]);
  mat4.scale(mMatrix, [2, 1.2, 1.0]);
  drawTriangle(mMatrix, [0.36, 0.77, 0.26, 1]);
  mMatrix = popMatrix(matrixStack);

  mMatrix = popMatrix(matrixStack);
}

function drawHouse(){
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [1.2, 1, 1]);
  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [1.5, 1.0, 1.0]);
  drawSquare(mMatrix, [1, 0.26, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [-0.75, 0, 0]);
  drawTriangle(mMatrix, [1, 0.26, 0, 1]);
  mat4.translate(mMatrix, [1.5, 0.0, 0.0]);
  drawTriangle(mMatrix, [1, 0.26, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [1.75, 1, 1]);
  mat4.translate(mMatrix, [0, -1, 0]);
  drawSquare(mMatrix, [0.88, 0.88, 0.88, 1]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [0.35, 0.35, 1.0]);
  mat4.translate(mMatrix, [-1.5, -2.5, 0]);
  drawSquare(mMatrix, [0.88, 0.66, 0, 1]);
  mat4.translate(mMatrix, [3.0, 0.0, 0.0]);
  drawSquare(mMatrix, [0.88, 0.66, 0, 1]);
  mat4.translate(mMatrix, [-1.5, -0.8, 0.0]);
  mat4.scale(mMatrix, [0.8, 2.0, 1.0]);
  drawSquare(mMatrix, [0.88, 0.66, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  mMatrix = popMatrix(matrixStack);
}

function drawBoat(){
  pushMatrix(matrixStack, mMatrix);
  
  mat4.translate(mMatrix, [0, -0.5, 0]);
  mat4.scale(mMatrix, [0.5, 0.5, 1.0]);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [0.05, 2.2, 0]);
  mat4.translate(mMatrix, [0, 0.5, 0.0]);
  drawSquare(mMatrix, [0.0, 0.0, 0.0, 1.0]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [-0.45, 1.1, 0]);
  mat4.scale(mMatrix, [2.0, 2.0, 0]);
  mat4.rotateZ(mMatrix, degToRad(65));
  drawLine(mMatrix, [0.0, 0.0, 0.0, 1.0]);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.rotateZ(mMatrix, degToRad(180));
  drawLowerBody([0.77, 0.77, 0.77, 1]);
  mMatrix = popMatrix(matrixStack);
  
  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0.525, 1.2, 0]);
  mat4.scale(mMatrix, [1, 1.5, 0.0]);
  mat4.rotateZ(mMatrix, degToRad(-90));
  drawTriangle(mMatrix, [0.88, 0.26, 0, 1]);
  mMatrix = popMatrix(matrixStack);

  mMatrix = popMatrix(matrixStack);
}

function drawBushes() {
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [0.5, 0.5, 1.0])
  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [-1.0, 0.0, 0.0]);
  drawCircle(mMatrix, [0.0, 0.66, 0.0, 1.0]);
  mMatrix = popMatrix(matrixStack);
  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [1.0, 0.0, 0.0]);
  drawCircle(mMatrix, [0.0, 0.36, 0.0, 1.0]);
  mMatrix = popMatrix(matrixStack);
  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [2.0, 1.4, 1.0]);
  drawCircle(mMatrix, [0.0, 0.55, 0.0, 1.0])
  mMatrix = popMatrix(matrixStack);

  mMatrix = popMatrix(matrixStack);
}

function drawCar() {
  pushMatrix(matrixStack, mMatrix);

  mat4.scale(mMatrix, [0.5, 0.5, 1.0])
  drawUpperBody();
  mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
  mat4.translate(mMatrix, [-1.05, -1.2, 0.0]);
  drawTyre();
  mat4.translate(mMatrix, [2.1, 0.0, 0.0]);
  drawTyre();
  mat4.scale(mMatrix, [2.0, 2.0, 1.0]);
  mat4.translate(mMatrix, [-0.55, 0.3, 0.0]);
  drawLowerBody([0.0, 0.45, 0.88, 1.0]);

  mMatrix = popMatrix(matrixStack);
}

function drawUpperBody(){
  pushMatrix(matrixStack, mMatrix);

  drawSquare(mMatrix, [0.77, 0.36, 0.26, 1]);
  mat4.translate(mMatrix, [-0.5, 0, 0]);
  drawTriangle(mMatrix, [0.77, 0.36, 0.26, 1]);
  mat4.translate(mMatrix, [1.0, 0.0, 0.0]);
  drawTriangle(mMatrix, [0.77, 0.36, 0.26, 1]);

  mMatrix = popMatrix(matrixStack);
}

function drawLowerBody(colors){
  pushMatrix(matrixStack, mMatrix);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [2.0, 0.5, 1.0]);
  drawSquare(mMatrix, colors);
  mMatrix = popMatrix(matrixStack);
  mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
  mat4.translate(mMatrix, [-2.0, 0.0, 0.0]);
  drawTriangle(mMatrix, colors);
  mat4.translate(mMatrix, [4.0, 0.0, 0.0]);
  drawTriangle(mMatrix, colors);

  mMatrix = popMatrix(matrixStack);
}

function drawTyre(){
    pushMatrix(matrixStack, mMatrix);

    drawCircle(mMatrix, [0.0, 0.0, 0.0, 1.0]);
    mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    drawCircle(mMatrix, [0.45, 0.45, 0.45, 1]);

    mMatrix = popMatrix(matrixStack);
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("myCanvas");
  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  uColorLoc = gl.getUniformLocation(shaderProgram, "color");

  initSquareBuffer();
  initTriangleBuffer();
  initCircleBuffer(30);
  initLine();

  drawScene();
}

function toggle(num) {
  if (display == num) return;
  display = num;
  webGLStart();
}
