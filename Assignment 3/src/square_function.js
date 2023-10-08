var squareVertexBuffer;
var squareTexCoordBuffer;
var squareIndexBuffer;
var squareNormalBuffer;

function initSquare(){
    var vertices = [
        -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.5, 0.0
    ];
    var indices = [0, 1, 2, 0, 2, 3];
    var texCoords = [0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0];
    var normals = [0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0];
  
    // Create and store data into vertex buffer
    squareVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    squareVertexBuffer.itemSize = 3;
    squareVertexBuffer.numItems = 4;
  
    // Create and store data into texture buffer
    squareTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, squareTexCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(texCoords),
      gl.STATIC_DRAW
    );
    squareTexCoordBuffer.itemSize = 2;
    squareTexCoordBuffer.numItems = 4;
  
    // Create and store data into normal buffer
    squareNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, squareNormalBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(normals),
      gl.STATIC_DRAW
    );
    squareNormalBuffer.itemSize = 3;
    squareNormalBuffer.numItems = 4;

    // Create and store data into index buffer
    squareIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, squareIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
    );
    squareIndexBuffer.itemSize = 1;
    squareIndexBuffer.numItems = 6;
  }
  
  function drawSquare(color = [1, 1, 0, 0.0]) {
    // Draw the square
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexBuffer);
    gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, squareTexCoordBuffer);
    gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, squareNormalBuffer);
    gl.vertexAttribPointer(aNormalLocation, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, squareIndexBuffer);

    gl.uniform1f(doRefraction, REFRACTIVE_INDEX);
    gl.uniform4fv(uDiffuseTermLocation, color);
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    gl.activeTexture(gl.TEXTURE1); // set texture unit 0 to use
    gl.bindTexture(gl.TEXTURE_2D, textureMap); // bind the texture object to the texture unit
    gl.uniform1i(uTextureLocation, 1); // pass the texture unit to the shader
    gl.drawElements(gl.TRIANGLES, squareIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  }
