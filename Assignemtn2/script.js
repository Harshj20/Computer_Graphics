////////////////////////////////////////////////////////////////////////
//  A simple WebGL program to draw a 3D cube wirh basic interaction.
//

var gl;
var gl2;
var gl3;
var canvas;
var matrixStack = [];

var buf;
var indexBuf;
var aPositionLocation;
var aNormalLocation;
var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;

var lightSliderX = 2;
var scaleSlider = 4;

var spBuf;
var spIndexBuf;
var spNormalBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var degree1 = [0.0, 0.0, 0.0];
var degree0 = [0.0, 0.0, 0.0];
var prevMouseX = [0.0, 0.0, 0.0];
var prevMouseY = [0.0, 0.0, 0.0];

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, scaleSlider];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}


const vertexShaderCodeFace = `#version 300 es
in vec3 aPosition;
uniform vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
out vec4 posInEyeSpace;

void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  gl_PointSize=5.0;
  posInEyeSpace = uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;

// Fragment shader code
const fragShaderCodeFace = `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec4 objColor;
in vec4 posInEyeSpace;
uniform vec3 lightDirection;

void main() {
  vec3 normal = normalize(cross(dFdx(posInEyeSpace.xyz), dFdy(posInEyeSpace.xyz)));
  vec3 lightDir = normalize(lightDirection - posInEyeSpace.xyz);
  vec3 reflection = normalize(-reflect(lightDir, normal));
  vec3 viewDir = normalize(-posInEyeSpace.xyz);
  vec3 ambient = vec3(0.2);
  vec3 diffuse = max(dot(normal, lightDir), 0.0) * vec3(1);
  vec3 specular = pow(max(dot(reflection, viewDir), 0.0), 20.0) * vec3(1);
  vec3 lighting = ambient + diffuse + specular;
  fragColor = vec4(objColor.rgb * lighting, objColor.a);
}`; 

// Vertex shader code
const vertexShaderCodeV = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
out vec4 color;

uniform vec4 objColor;
uniform vec3 lightDirection;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

void main() {
  vec4 vPos4 = uVMatrix * uMMatrix * vec4(aPosition, 1.0); 
  gl_Position = uPMatrix * vPos4;
  gl_PointSize=5.0;
  vec3 vPos = vec3(vPos4) / vPos4.w;
  vec3 N = mat3(transpose(inverse(uMMatrix)))*aNormal;
  vec3 vNormal = normalize(N);
  vec3 lightDir = normalize(lightDirection - vPos);
  vec3 viewDir = normalize(-vPos);

  vec3 reflection = normalize(reflect(-lightDir, vNormal));
  vec3 ambient = vec3(0.2);
  vec3 diffuse = max(dot(vNormal, lightDir), 0.0) * vec3(1.0);
  vec3 specular = pow(max(dot(reflection, viewDir), 0.0), 32.0) * vec3(1.0);
  vec3 lighting = ambient + diffuse + specular;
  color = vec4(objColor.rgb * lighting, objColor.a);
}`;

// Fragment shader code
const fragShaderCodeV = `#version 300 es
precision mediump float;
in vec4 color;
out vec4 fragColor;

void main() {
  fragColor = color;
}`;


const vertexShaderCodeF = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
out vec4 color;
out vec3 normal;
out vec3 vPos;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
out mat3 normalMat;

void main() {
  vec4 vPos4 = uVMatrix * uMMatrix * vec4(aPosition, 1.0); 
  gl_Position = uPMatrix * vPos4;
  gl_PointSize=5.0;
  normal = aNormal;
  normalMat = mat3(transpose(inverse(uVMatrix*uMMatrix)));
  vPos = vec3(vPos4) / vPos4.w;
}`;

const fragShaderCodeF = `#version 300 es
precision mediump float;

uniform vec4 objColor;
uniform vec3 lightDirection;
in vec3 normal;
in vec3 vPos;
in mat3 normalMat;
out vec4 fragColor;

void main() {
  vec3 N = normalMat * normal;
  vec3 vNormal = normalize(N);
  vec3 lightDir = normalize(lightDirection - vPos);
  vec3 viewDir = normalize(-vPos);

  vec3 reflection = normalize(reflect(-lightDir, vNormal));
  vec3 ambient = vec3(0.2);
  vec3 diffuse = max(dot(vNormal, lightDir), 0.0) * vec3(1.0);
  vec3 specular = pow(max(dot(reflection, viewDir), 0.0), 32.0) * vec3(1.0);
  vec3 lighting = ambient + diffuse + specular;
  fragColor = vec4(objColor.rgb * lighting, objColor.a);
}`;

function vertexShaderSetup(vcode, obj) {
  shader = obj.createShader(obj.VERTEX_SHADER);
  obj.shaderSource(shader, vcode);
  obj.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!obj.getShaderParameter(shader, obj.COMPILE_STATUS)) {
    alert(obj.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fcode, obj) {
  shader = obj.createShader(obj.FRAGMENT_SHADER);
  obj.shaderSource(shader, fcode);
  obj.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!obj.getShaderParameter(shader, obj.COMPILE_STATUS)) {
    alert(obj.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(obj, vcode, fcode) {
  shaderProgram = obj.createProgram();

  var vertexShader = vertexShaderSetup(vcode, obj);
  var fragmentShader = fragmentShaderSetup(fcode, obj);

  // attach the shaders
  obj.attachShader(shaderProgram, vertexShader);
  obj.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  obj.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!obj.getProgramParameter(shaderProgram, obj.LINK_STATUS)) {
    console.log(obj.getShaderInfoLog(vertexShader));
    console.log(obj.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  obj.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas, obj) {
  try {
    obj = canvas.getContext("webgl2"); // the graphics webgl2 context
    obj.viewportWidth = canvas.width/3; // the width of the canvas
    obj.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!obj) {
    alert("WebGL initialization failed");
  }
  return obj;
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
  var theta1, theta2;

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(-radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(-1.0);
    spNormals.push(0);
  }

  for (j = 1; j < nstacks - 1; j++) {
    theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
    for (i = 0; i < nslices; i++) {
      theta2 = (i * 2 * Math.PI) / nslices;
      spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
      spVerts.push(radius * Math.sin(theta1));
      spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));

      spNormals.push(Math.cos(theta1) * Math.cos(theta2));
      spNormals.push(Math.sin(theta1));
      spNormals.push(Math.cos(theta1) * Math.sin(theta2));
    }
  }

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(1.0);
    spNormals.push(0);
  }

  // setup the connectivity and indices
  for (j = 0; j < nstacks - 1; j++)
    for (i = 0; i <= nslices; i++) {
      var mi = i % nslices;
      var mi2 = (i + 1) % nslices;
      var idx = (j + 1) * nslices + mi;
      var idx2 = j * nslices + mi;
      var idx3 = j * nslices + mi2;
      var idx4 = (j + 1) * nslices + mi;
      var idx5 = j * nslices + mi2;
      var idx6 = (j + 1) * nslices + mi2;

      spIndicies.push(idx);
      spIndicies.push(idx2);
      spIndicies.push(idx3);
      spIndicies.push(idx4);
      spIndicies.push(idx5);
      spIndicies.push(idx6);
    }
}

function initSphereBuffer(obj) {
  var nslices = 30; // use even number
  var nstacks = nslices / 2 + 1;
  var radius = 1.0;
  initSphere(nslices, nstacks, radius);

  spBuf = obj.createBuffer();
  obj.bindBuffer(obj.ARRAY_BUFFER, spBuf);
  obj.bufferData(obj.ARRAY_BUFFER, new Float32Array(spVerts), obj.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = nslices * nstacks;

  spNormalBuf = obj.createBuffer();
  obj.bindBuffer(obj.ARRAY_BUFFER, spNormalBuf);
  obj.bufferData(obj.ARRAY_BUFFER, new Float32Array(spNormals), obj.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = nslices * nstacks;

  spIndexBuf = obj.createBuffer();
  obj.bindBuffer(obj.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  obj.bufferData(
    obj.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    obj.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

function drawSphere(color, obj) {
  obj.bindBuffer(obj.ARRAY_BUFFER, spBuf);
  obj.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    obj.FLOAT,
    false,
    0,
    0
  );

  obj.bindBuffer(obj.ARRAY_BUFFER, spNormalBuf);
  obj.vertexAttribPointer(
    aNormalLocation,
    spNormalBuf.itemSize,
    obj.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - trianobje indices
  obj.bindBuffer(obj.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  obj.uniform4fv(uColorLocation, color);
  obj.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  obj.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  obj.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  obj.drawElements(obj.TRIANGLES, spIndexBuf.numItems, obj.UNSIGNED_INT, 0);
  // gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  // gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

function initCubeBuffer(obj) {
  var vertices = [
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ];
  buf = obj.createBuffer();
  obj.bindBuffer(obj.ARRAY_BUFFER, buf);
  obj.bufferData(obj.ARRAY_BUFFER, new Float32Array(vertices), obj.STATIC_DRAW);
  buf.itemSize = 3;
  buf.numItems = vertices.length / 3;

  var normals = [
    // Front face
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back face
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top face
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom face
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right face
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left face
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];
  cubeNormalBuf = obj.createBuffer();
  obj.bindBuffer(obj.ARRAY_BUFFER, cubeNormalBuf);
  obj.bufferData(obj.ARRAY_BUFFER, new Float32Array(normals), obj.STATIC_DRAW);
  cubeNormalBuf.itemSize = 3;
  cubeNormalBuf.numItems = normals.length / 3;

  var indices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    5,
    6,
    4,
    6,
    7, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Top face
    12,
    13,
    14,
    12,
    14,
    15, // Bottom face
    16,
    17,
    18,
    16,
    18,
    19, // Right face
    20,
    21,
    22,
    20,
    22,
    23, // Left face
  ];
  indexBuf = obj.createBuffer();
  obj.bindBuffer(obj.ELEMENT_ARRAY_BUFFER, indexBuf);
  obj.bufferData(
    obj.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    obj.STATIC_DRAW
  );
  indexBuf.itemSize = 1;
  indexBuf.numItems = indices.length;
}

function drawCube(color, obj) {
  obj.bindBuffer(obj.ARRAY_BUFFER, buf);
  obj.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    obj.FLOAT,
    false,
    0,
    0
  );

  obj.bindBuffer(obj.ARRAY_BUFFER, cubeNormalBuf);
  obj.vertexAttribPointer(
    aNormalLocation,
    cubeNormalBuf.itemSize,
    obj.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - trianobje indices
  obj.bindBuffer(obj.ELEMENT_ARRAY_BUFFER, indexBuf);

  obj.uniform4fv(uColorLocation, color);
  obj.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  obj.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  obj.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  obj.drawElements(obj.TRIANGLES, indexBuf.numItems, obj.UNSIGNED_SHORT, 0);
  // gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  // gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

////////////////////////////////////////////////////////////////////
//Main drawing routine

function drawScene1(){
  
  mat4.translate(mMatrix, [0, 0.3, 0]);
  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [1.25, 2, 1.25]);
  mat4.translate(mMatrix, [0, -0.7, 0]);
  drawCube([0.45, 0.46, 0.31, 1], gl);
  mMatrix = popMatrix(matrixStack);

  mat4.scale(mMatrix, [0.75, 0.75, 0.75]);
  mat4.translate(mMatrix, [0, 0.45, 0]);
  drawSphere([0, 0.4, 0.6, 1], gl);
}

function drawScene2(){

  drawSphere([0.6, 0.6, 0.6, 1], gl);
  mat4.translate(mMatrix, [-0.87, 1.5,  0]);
  mat4.rotate(mMatrix, degToRad(-30), [0, 0, 1]);
  {
    pushMatrix(matrixStack, mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -0.7, 0]);
    drawCube([0, 0.5, 0, 1], gl);
    mMatrix = popMatrix(matrixStack);
    mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    mat4.translate(mMatrix, [0, 0.6, 0]);
    drawSphere([0.6, 0.6, 0.6, 1], gl);
      mat4.translate(mMatrix, [0, 1.6, 0 ]);
      mat4.rotate(mMatrix, degToRad(45), [0, 1, 0]);
      mat4.rotate(mMatrix, degToRad(60), [0, 0, 1]);
      {
        pushMatrix(matrixStack, mMatrix);
        pushMatrix(matrixStack, mMatrix);
        mat4.translate(mMatrix, [0, -0.7, 0]);
        drawCube([0, 0.5, 0, 1], gl);
        mMatrix = popMatrix(matrixStack);
        mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
        mat4.translate(mMatrix, [0, 0.6, 0]);
        drawSphere([0.6, 0.6, 0.6, 1], gl);
        mMatrix = popMatrix(matrixStack);
      }
    mMatrix = popMatrix(matrixStack);
  }


}

function drawScene3(){
  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [1, 0.1, 2]);
  mat4.translate(mMatrix, [-1.25, 0, 0]);
  drawCube([0.65, 0.65, 0, 1], gl);
  mat4.translate(mMatrix, [2.5, 0, 0]);
  drawCube([0.17, 0.64, 0.5, 1], gl);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
  mat4.translate(mMatrix, [-2.75, 1.1, 0]);
  drawSphere([0.67, 0, 0.67, 1], gl);
  mat4.translate(mMatrix, [0, -2.2, 0]);
  drawSphere([0.25, 0.25, 0.5, 1], gl);
  mat4.translate(mMatrix, [5.5, 0, 0]);
  drawSphere([0.1, 0.33, 0.39, 1], gl);
  mat4.translate(mMatrix, [0, 2.2, 0]);
  drawSphere([0.59, 0.41, 0.12, 1], gl);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.scale(mMatrix, [3.5, 0.1, 1]);
  mat4.translate(mMatrix, [0, 11, 0]);
  drawCube([0.68, 0.22, 0.07, 1], gl);
  mat4.translate(mMatrix, [0, -22, 0]);
  drawCube([0.68, 0.22, 0.07, 1], gl);
  mMatrix = popMatrix(matrixStack);
  
  mat4.scale(mMatrix, [0.65, 0.65, 0.65]);
  mat4.translate(mMatrix, [0, 2.75, 0]);
  drawSphere([0.4, 0.4, 0.5, 1], gl);
  mat4.translate(mMatrix, [0, -5.5, 0]);
  drawSphere([0, 0.6, 0.1, 1], gl);
}

function drawScene() {
  gl.enable(gl.SCISSOR_TEST);
  attachShaders(gl, vertexShaderCodeFace, fragShaderCodeFace);
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.scissor(0, 0, 500, 500);
  gl.clearColor(0.83, 0.83, 0.93, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
  
  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);
  
  //set up the model matrix
  mat4.identity(mMatrix);
  
  // transformations applied here on model matrix
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0[0]), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1[0]), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
  drawScene1();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mat4.translate(mMatrix, [0, -0.6, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0[1]), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1[1]), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.75, 0.75, 0.75]);
  attachShaders(gl, vertexShaderCodeV, fragShaderCodeV);
  gl.viewport(500, 0, gl.viewportWidth, gl.viewportHeight);
  gl.scissor(500, 0, 500, 500);
  gl.clearColor(0.93, 0.83, 0.82, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene2();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0[2]), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1[2]), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
  attachShaders(gl, vertexShaderCodeF, fragShaderCodeF);
  gl.viewport(1000, 0, gl.viewportWidth, gl.viewportHeight);
  gl.scissor(1000, 0, 500, 500);
  gl.clearColor(0.83, 0.93, 0.83, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene3();
  mMatrix = popMatrix(matrixStack);
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    for(let i = 0; i < 3; i++){
      if(event.layerX <= i*500 + canvas.width/3 &&
        event.layerX >= i*500){
          prevMouseX[i] = event.clientX - i*500;
          prevMouseY[i] = canvas.height - event.clientY;
        }
    }
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  let update = false;
  if (
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    for(let i = 0; i < 3; i++){
      if(event.layerX <= (i+1)*500 &&
        event.layerX >= i*500){
          var mouseX = event.clientX - i*500;
          var diffX1 = mouseX - prevMouseX[i];
          prevMouseX[i] = mouseX;
          degree0[i] = degree0[i] + diffX1 / 5;

          var mouseY = canvas.height - event.clientY;
          var diffY2 = mouseY - prevMouseY[i];
          prevMouseY[i] = mouseY;
          degree1[i] = degree1[i] - diffY2 / 5;
          update = true;
          break;
          // console.log(event.layerX);
      }
    }
    if(update){
      drawScene();
    }
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

var lightDirection = [lightSliderX, 5, 0.75];

function attachShaders(obj, vCode, fCode){
   // initialize shader program
   shaderProgram = initShaders(obj, vCode, fCode);

   //get locations of attributes and uniforms declared in the shader
   aPositionLocation = obj.getAttribLocation(shaderProgram, "aPosition");
   uMMatrixLocation = obj.getUniformLocation(shaderProgram, "uMMatrix");
   uVMatrixLocation = obj.getUniformLocation(shaderProgram, "uVMatrix");
   uPMatrixLocation = obj.getUniformLocation(shaderProgram, "uPMatrix");
   uColorLocation = obj.getUniformLocation(shaderProgram, "objColor");
   aNormalLocation = obj.getAttribLocation(shaderProgram, "aNormal");
   obj.uniform3fv(obj.getUniformLocation(shaderProgram, "lightDirection"), lightDirection);
   //enable the attribute arrays
   obj.enableVertexAttribArray(aPositionLocation);
   obj.enableVertexAttribArray(aNormalLocation);
   obj.enable(obj.DEPTH_TEST);
   initCubeBuffer(obj);
   initSphereBuffer(obj);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("myCanvas");
  document.addEventListener("mousedown", onMouseDown, false);

  var slider = document.getElementById("slider");
  slider.addEventListener("input", updateLightSlider, false);
  var slider2 = document.getElementById("slider2");
  slider2.addEventListener("input", updateScaleSlider, false);

  // initialize WebGL
  gl = initGL(canvas, gl);
  // gl2 = initGL(canvas, gl2);
  // gl3 = initGL(canvas, gl3);

  drawScene();
}


function updateLightSlider() {
  lightSliderX = document.getElementById("slider").value;
  lightDirection[0] = lightSliderX;
  // gl.uniform3fv(gl.getUniformLocation(shaderProgram, "lightDirection"), lightDirection);                                     
  drawScene();
}

function updateScaleSlider(){
  scaleSlider = document.getElementById("slider2").value;
  eyePos[2] = scaleSlider;
  drawScene();
}