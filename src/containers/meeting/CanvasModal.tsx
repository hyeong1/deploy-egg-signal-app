"use client";

import React, { useRef, useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
import { useRecoilValue } from "recoil";
import { userState } from "@/app/store/userInfo";
import { meetingSocketState } from "@/app/store/socket";
import "@/styles/canvas.css";

type CanvasModalProps = {
  onClose: () => void;
};

const CanvasModal: React.FC<CanvasModalProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("black");
  const [brushSize, setBrushSize] = useState(8);
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [currentStage, setCurrentStage] = useState("drawing");

  const socket = useRecoilValue(meetingSocketState)!;
  const userInfo = useRecoilValue(userState);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = 270;
    canvas.height = 240;
    canvas.style.width = "360px";
    canvas.style.height = "320px";

    const context = canvas.getContext("2d")!;
    context.lineCap = "round";
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    context.fillStyle = "#f0f0f0";
    context.fillRect(0, 0, canvas.width, canvas.height);
    contextRef.current = context;

    socket.on("startDrawing", () => {
      setCurrentStage("drawing");
    });

    

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  const startDrawing = ({ nativeEvent }: React.MouseEvent) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current!.beginPath();
    contextRef.current!.moveTo(offsetX * (270 / 360), offsetY * (240 / 320));
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    contextRef.current!.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }: React.MouseEvent) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current!.lineTo(offsetX * (270 / 360), offsetY * (240 / 320));
    contextRef.current!.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const context = contextRef.current!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f0f0f0";
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleForwardDrawing = async () => {
    const canvas = canvasRef.current!;
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/webp"),
    );
    if (blob) {
      const resizedBlob = await resizeAndCompressImage(blob, canvas.width);
      const arrayBuffer = await resizedBlob.arrayBuffer();
      socket.emit("forwardDrawing", {
        userName: userInfo?.nickname,
        drawing: arrayBuffer,
      });
    }
  };

  const resizeAndCompressImage = async (blob: Blob, width: number) => {
    const file = new File([blob], "drawing", {
      type: "image/webp",
    });

    return await imageCompression(file, {
      maxSizeMB: 0.1,
      maxWidthOrHeight: width * 0.5,
      useWebWorker: true,
      fileType: "image/webp",
    });
  };

  return (
    <div className="canvas-modal">
      <div className="canvas-modal-content">
        <span className="canvas-close" onClick={onClose}>
          &times;
        </span>
        {currentStage === "drawing" && (
          <div className="flex flex-col justify-center items-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseUp={finishDrawing}
              onMouseMove={draw}
            />
            <div>
              {["red", "orange", "green", "blue", "black", "white"].map(col => (
                <button
                  key={col}
                  onClick={() => setColor(col)}
                  style={{ backgroundColor: col, margin: "0 5px" }}
                ></button>
              ))}
            </div>
            <div>
              <label>굵기</label>
              {[5, 8, 12].map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  style={{ margin: "0 5px" }}
                >
                  {size}px
                </button>
              ))}
            </div>
            <div>
              <button onClick={clearCanvas}>전부 지우기</button>
            </div>
            <button onClick={handleForwardDrawing}>그림 제출</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasModal;
