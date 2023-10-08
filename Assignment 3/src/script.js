var gl;
var canvas;
var matrixStack = [];
var animation;
var zAngle = 0.0;
var yAngle = 0.0;
var isTexture;
var doTexture = 0;

var prevMouseX = 0;
var prevMouseY = 0;

var REFRACTIVE_INDEX = 0;

var aPositionLocation;
var aTexCoordLocation;

var doRefraction = 0;
var angle = 0;

var aNormalLocation;
var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;

var uDiffuseTermLocation;
var uTextureLocation;
var sphTexture;
var cubTexture;
var textureMap;
var textureWood = "../textures/wood_texture.jpg";
var textureRubiks = "../textures/rcube.png";

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

var eyePos = [0.0, 2.0, 6];
var lightDirection = [3, 5, 0.75];

var cubeMapPath = "../skybox/";
var posx, posy, posz, negx, negy, negz;

var posx_file = cubeMapPath.concat("posx.jpg");
var posy_file = cubeMapPath.concat("posy.jpg");
var posz_file = cubeMapPath.concat("posz.jpg");
var negx_file = cubeMapPath.concat("negx.jpg");
var negy_file = cubeMapPath.concat("negy.jpg");
var negz_file = cubeMapPath.concat("negz.jpg");
var ori_posz = cubeMapPath.concat("ori_posz.jpg");


const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

out vec3 normal;
out vec3 vPos;

out vec3 v_worldPosition;
out vec3 v_worldNormal;

out vec2 fragTexCoord;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

void main() {
  vec4 vPos4 = uVMatrix * uMMatrix * vec4(aPosition, 1.0); 
  gl_Position = uPMatrix * vPos4;
  gl_PointSize=5.0;
  normal = normalize(mat3(transpose(inverse(uVMatrix*uMMatrix)))*aNormal);
  vPos = vec3(vPos4) / vPos4.w;

  v_worldPosition = vec3(uMMatrix * vec4(aPosition, 1.0));
  v_worldNormal = normalize(mat3(transpose(inverse(uMMatrix))) * aNormal);
  fragTexCoord = aTexCoords;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform samplerCube cubeMap;
in vec3 v_worldPosition;
in vec3 v_worldNormal;

in vec2 fragTexCoord;
uniform sampler2D imageTexture;

uniform vec3 eyePos;
uniform vec4 objColor;
uniform vec3 lightDirection;
uniform float isRefraction;
in vec3 normal;
in vec3 vPos;

out vec4 fragColor;

void main() {
  vec3 eyeToSurfaceDir = normalize(v_worldPosition - eyePos);
  vec3 directionReflection;
  if(isRefraction == 0.0)
    directionReflection = reflect(eyeToSurfaceDir, v_worldNormal);
  if(isRefraction > 0.0)
    directionReflection = refract(eyeToSurfaceDir, v_worldNormal, isRefraction);

  vec4 cubeMapReflectCol = texture(cubeMap, directionReflection);

  vec4 textureColor = texture(imageTexture, fragTexCoord);
  vec4 color = vec4(mix(textureColor, vec4(objColor.rgb, 1.0), float(int(objColor.a)) / 100.0).rgb, objColor.a - float(int(objColor.a)));

  vec3 lightDir = normalize(lightDirection - vPos);
  vec3 viewDir = normalize(-vPos);

  vec3 reflection = normalize(reflect(-lightDir, normal));
  vec3 ambient = vec3(0.4);

  vec3 diffuse = max(dot(normal, lightDir), 0.0) * vec3(1.0);
  vec3 specular;
  if(isRefraction >= 0.0)
    specular = pow(max(dot(reflection, viewDir), 0.0), 40.0) * vec3(1.0);
  else
    specular = vec3(0.0, 0.0, 0.0);
  vec3 lighting = 0.6*diffuse + ambient + specular;

  fragColor = vec4(lighting*(mix( vec4(color.rgb, 1.0), cubeMapReflectCol, color.a).rgb) + specular, 1.0);
}`;

function initTextures(textureFile) {
  var tex = gl.createTexture();
  tex.image = new Image();
  tex.image.crossOrigin = "anonymous";
  tex.image.src = textureFile;
  tex.image.onload = function () {
  handleTextureLoaded(tex);
  };
  return tex;
}

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); // use it to flip Y if needed
  gl.texImage2D(
    gl.TEXTURE_2D, // 2D texture
    0, // mipmap level
    gl.RGB, // internal format
    gl.RGB, // format
    gl.UNSIGNED_BYTE, // type of data
    texture.image // array or <img>
  );

  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );

  drawScene();
}

function initCubeMap() {
  const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: posx_file,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: negx_file,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: posy_file,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: negy_file,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: posz_file,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: negz_file,
    },
  ];

  cubemapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);

    faceInfos.forEach((faceInfo) => {
        const {target, url} = faceInfo;

        gl.texImage2D(
            target,
            0,
            gl.RGBA,
            512,
            512,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        const image = new Image();
        image.src = url;
        image.crossOrigin = "anonymous";
        image.addEventListener('load', function() {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            drawScene();
        });
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
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
  
  function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
  }
  
  function pushMatrix(stack, m) {
    //necessary because javascript only does shallow push
    var copy = mat4.create(m);
    stack.push(copy);
  }
  
  function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack has no matrix to pop!");
  }

  function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    if (animation) {
      window.cancelAnimationFrame(animation);
    }
    //set up the model matrix
    var animate = ()=>{
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      angle = (angle - 0.25)%360;
      eyePos[0] = 6*Math.sin(degToRad(angle));
      eyePos[2] = 6*Math.cos(degToRad(angle)) - 0.5;

      mat4.identity(mMatrix);
    
      // set up the view matrix, multiply into the modelview matrix
      mat4.identity(vMatrix);
      vMatrix = mat4.lookAt(eyePos, [0, 1, 0], [0, 1, 0], vMatrix);
      //set up projection matrix
      mat4.identity(pMatrix);
      mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
      mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
      mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);

      gl.uniform3fv(gl.getUniformLocation(shaderProgram, "eyePos"), eyePos);

      //draw skybox
      pushMatrix(matrixStack, mMatrix);
      REFRACTIVE_INDEX = -1.0;
      drawSkyBox();
      REFRACTIVE_INDEX = 0.0;
      mMatrix = popMatrix(matrixStack);
    
      // draw teapot
      textureMap = sphTexture;
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [0, 0, -1.8]);
      mat4.scale(mMatrix, [0.14, 0.14, 0.14]);
      mat4.translate(mMatrix, [0, 5.5, 0]);
      drawObject([0.17, 0.64, 0.5, 100.9]);
      mMatrix = popMatrix(matrixStack);

      //draw first Sphere
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [0, 0.12, 1]);
      mat4.scale(mMatrix, [0.75, 0.75, 0.75]);
      drawSphere([0.1, 0.64, 0.1, 100.6]);
      mMatrix = popMatrix(matrixStack);

      //draw second Sphere
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [1.5, 0, 0]);
      mat4.scale(mMatrix, [0.6, 0.6, 0.6]);
      drawSphere([0.4, 0.3, 0.5, 100.6]);
      mMatrix = popMatrix(matrixStack);

      //draw rubiks cube
      textureMap = cubTexture;
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [1, 0, 1]);
      mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
      drawCube([0, 0, 0, 0.0]);
      mMatrix = popMatrix(matrixStack);

      //draw Refractive Cube
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [-1.5, 0.5, 0.35]);
      mat4.scale(mMatrix, [0.75, 1.5, 0.75]);
      mat4.rotate(mMatrix, degToRad(30), [0, 1, 0])
      REFRACTIVE_INDEX = 0.82;
      drawCube([0, 0, 0, 0.99]);
      REFRACTIVE_INDEX = 0;
      mMatrix = popMatrix(matrixStack);

      //draw Table
      textureMap = sphTexture;
      pushMatrix(matrixStack, mMatrix);
      mat4.translate(mMatrix, [0, 0, -0.4])
      mat4.scale(mMatrix, [1.3, 1.2, 1])
      drawTable();
      mMatrix = popMatrix(matrixStack);

      animation = window.requestAnimationFrame(animate);
    }
    animate();
  }

  function drawTable(){
    //draw table top
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -0.3, 0]);
    mat4.scale(mMatrix, [7, 0.1, 7]);
    drawSphere([0.45, 0.15, 0.03, 30.3]);
    mMatrix = popMatrix(matrixStack);

    //draw table legs
    mat4.translate(mMatrix, [0, 0.1, 0]);
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [1.8, -0.9, 1.8]);
    mat4.scale(mMatrix, [0.2, 1, 0.2]);
    drawCube([0.7, 0.7, 0.7, 0.2]);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-1.8, -0.9, 1.8]);
    mat4.scale(mMatrix, [0.2, 1, 0.2]);
    drawCube([0.7, 0.7, 0.7, 0.2]);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [1.8, -0.9, -1.8]);
    mat4.scale(mMatrix, [0.2, 1, 0.2]);
    drawCube([0.7, 0.7, 0.7, 0.2]);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-1.8, -0.9, -1.8]);
    mat4.scale(mMatrix, [0.2, 1, 0.2]);
    drawCube([0.7, 0.7, 0.7, 0.2]);
    mMatrix = popMatrix(matrixStack);
  }

  function drawSkyBox(){
    //back face
    textureMap = negz;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, 0, -99.5]);
    mat4.rotateY(mMatrix, degToRad(180) );
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

    //front face
    textureMap = posz;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, 0, 99.5]);
    mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

    //left face
    textureMap = negx;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [-99.5, 0, 0]);
       mat4.rotateY(mMatrix, degToRad(-90));
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

    //right face
    textureMap = posx;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [99.5, 0, 0]);
    mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

    //bottom face
    textureMap = negy;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, -99.5, 0]);
    mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

    //top face
    textureMap = posy;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0, 99.5, 0]);
    mat4.rotate(mMatrix, degToRad(-90), [1, 0, 0]);
    mat4.scale(mMatrix, [200, 200, 200]);
    drawSquare([0, 0, 0, 0.0]);
    mMatrix = popMatrix(matrixStack);

  }
  
  function onMouseDown(event) {
    document.addEventListener("mousemove", onMouseMove, false);
    document.addEventListener("mouseup", onMouseUp, false);
    document.addEventListener("mouseout", onMouseOut, false);
  
    if (
      event.layerX <= canvas.width &&
      event.layerX >= 0 &&
      event.layerY <= canvas.height &&
      event.layerY >= 0
    ) {
      prevMouseX = event.clientX;
      prevMouseY = canvas.height - event.clientY;
    }
  }
  
  function onMouseMove(event) {
    // make mouse interaction only within canvas
    if (
      event.layerX <= canvas.width &&
      event.layerX >= 0 &&
      event.layerY <= canvas.height &&
      event.layerY >= 0
    ) {
      var mouseX = event.clientX;
      var diffX = mouseX - prevMouseX;
      zAngle = zAngle + diffX / 5;
      prevMouseX = mouseX;
  
      var mouseY = canvas.height - event.clientY;
      var diffY = mouseY - prevMouseY;
      yAngle = yAngle - diffY / 5;
      prevMouseY = mouseY;
  
      drawScene();
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
  
  // This is the entry point from the html
  function webGLStart() {
    canvas = document.getElementById("myCanvas");
    document.addEventListener("mousedown", onMouseDown, false);
  
    initGL(canvas);
    shaderProgram = initShaders();
  
    gl.enable(gl.DEPTH_TEST);
  
    //get locations of attributes declared in the vertex shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoords");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");

    doRefraction = gl.getUniformLocation(shaderProgram, "isRefraction");

    uDiffuseTermLocation = gl.getUniformLocation(shaderProgram, "objColor");

    gl.uniform3fv(gl.getUniformLocation(shaderProgram, "lightDirection"), lightDirection);

    uTextureLocation = gl.getUniformLocation(shaderProgram, "imageTexture");
    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aTexCoordLocation);
    gl.enableVertexAttribArray(aNormalLocation);
  
    //initialize buffers for the square
    
    initCubeMap();
    initObject();
    initCubeBuffer();
    initSphereBuffer();
    initSquare();
    posx = initTextures(posx_file);
    posy = initTextures(posy_file);
    posz = initTextures(ori_posz);
    negz = initTextures(negz_file);
    negx = initTextures(negx_file);
    negy = initTextures(negy_file);
    cubTexture = initTextures(textureRubiks);
    sphTexture = initTextures(textureWood);

  }