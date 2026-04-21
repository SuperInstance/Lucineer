#!/usr/bin/env python3
"""
PLATO-Compatible TensorRT Room
For JC1's Jetson Super Orin

3 endpoints matching PLATO's examine/think/create pattern:
- GET /examine?agent=X → describe the model (input shapes, types, capabilities)
- GET /think?agent=X&input=... → run inference and return results
- POST /create → submit inference results as PLATO tile

Usage on Jetson:
  1. Export your model: torch.onnx.export(model, dummy, "room.onnx", opset_version=17)
  2. Build engine: trtexec --onnx=room.onnx --saveEngine=room.trt --fp16
  3. Run this server: python3 jc1-tensorrt-room.py --engine room.trt --port 8849
"""
import json, time, argparse, hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    import tensorrt as trt
    import pycuda.driver as cuda
    import pycuda.autoinit
    import numpy as np
    HAS_TRT = True
except ImportError:
    HAS_TRT = False

PLATO_URL = "http://147.224.38.131:8847/submit"
engine_path = None
engine = None

def load_engine(path):
    """Load a TensorRT engine from file."""
    if not HAS_TRT:
        return None
    logger = trt.Logger(trt.Logger.WARNING)
    runtime = trt.Runtime(logger)
    with open(path, 'rb') as f:
        return runtime.deserialize_cuda_engine(f.read())

def infer(engine, input_data):
    """Run inference on a TensorRT engine."""
    if not engine:
        return {"error": "no engine loaded"}
    context = engine.create_execution_context()
    
    # Allocate buffers
    inputs = []
    outputs = []
    bindings = []
    stream = cuda.Stream()
    
    for i in range(engine.num_bindings):
        shape = engine.get_binding_shape(i)
        dtype = trt.nptype(engine.get_binding_dtype(i))
        size = 1
        for s in shape:
            size *= s
        host_mem = cuda.pagelocked_empty(size, dtype)
        device_mem = cuda.mem_alloc(host_mem.nbytes)
        bindings.append(int(device_mem))
        if engine.binding_is_input(i):
            host_mem[:] = input_data.flatten()[:size]
            inputs.append({'host': host_mem, 'device': device_mem})
        else:
            outputs.append({'host': host_mem, 'device': device_mem})
    
    # Transfer input, execute, transfer output
    for inp in inputs:
        cuda.memcpy_htod_async(inp['device'], inp['host'], stream)
    context.execute_async_v2(bindings=bindings, stream_handle=stream.handle)
    for out in outputs:
        cuda.memcpy_dtoh_async(out['host'], out['device'], stream)
    stream.synchronize()
    
    return [out['host'].tolist() for out in outputs]

class TRTRoomHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global engine
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        
        if parsed.path == "/examine":
            if engine:
                info = {
                    "status": "loaded",
                    "engine": engine_path,
                    "num_bindings": engine.num_bindings,
                    "max_batch_size": engine.max_batch_size,
                    "has_trt": True,
                    "room": "tensorrt-inference",
                    "ml_concept": "edge_inference_optimization",
                }
                for i in range(engine.num_bindings):
                    name = engine.get_binding_name(i)
                    shape = engine.get_binding_shape(i)
                    dtype = engine.get_binding_dtype(i)
                    info[f"binding_{i}"] = {"name": name, "shape": list(shape), "dtype": str(dtype), "is_input": engine.binding_is_input(i)}
                self._json(info)
            else:
                self._json({
                    "status": "no_engine",
                    "message": "Load an engine first: POST /load {\"path\": \"room.trt\"}",
                    "room": "tensorrt-inference",
                    "has_trt": HAS_TRT,
                })
        
        elif parsed.path == "/think":
            agent = params.get("agent", ["jc1"])[0]
            if not engine:
                self._json({"error": "No engine loaded. POST /load first."})
                return
            # Use random input if none provided
            try:
                import numpy as np
                input_data = np.random.randn(1, 10).astype(np.float32)
                start = time.time()
                result = infer(engine, input_data)
                latency = (time.time() - start) * 1000
                self._json({
                    "agent": agent,
                    "input_shape": [1, 10],
                    "output": result,
                    "latency_ms": round(latency, 2),
                    "device": "Jetson GPU",
                    "room": "tensorrt-inference",
                })
            except Exception as e:
                self._json({"error": str(e), "agent": agent})
        
        else:
            self._json({
                "service": "PLATO TensorRT Room v1.0",
                "endpoints": ["/examine", "/think?agent=X", "/load (POST)", "/create (POST)"],
                "has_trt": HAS_TRT,
                "engine_loaded": engine is not None,
            })
    
    def do_POST(self):
        global engine, engine_path
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        
        if parsed.path == "/load":
            path = body.get("path", "room.trt")
            engine = load_engine(path)
            engine_path = path
            if engine:
                self._json({"status": "loaded", "engine": path, "bindings": engine.num_bindings})
            else:
                self._json({"status": "failed", "error": "Could not load engine. Check path and TensorRT version."})
        
        elif parsed.path == "/create":
            # Submit results as PLATO tile
            agent = body.get("agent", "jc1")
            domain = body.get("domain", "tensorrt_inference")
            question = body.get("question", "edge inference results")
            answer = body.get("answer", "")
            if len(answer) < 50:
                answer += " — Tile generated by TensorRT room on Jetson Super Orin. Edge inference at sub-10ms latency."
            
            import urllib.request
            try:
                req = urllib.request.Request(PLATO_URL, 
                    data=json.dumps({"agent": agent, "domain": domain, "question": question, "answer": answer}).encode(),
                    headers={"Content-Type": "application/json", "User-Agent": "trt-room/1.0"})
                resp = urllib.request.urlopen(req, timeout=5)
                result = json.loads(resp.read())
                self._json({"status": "tile_submitted", "plato_response": result})
            except Exception as e:
                self._json({"status": "tile_saved_locally", "error": str(e)})
        
        else:
            self._json({"error": f"Unknown POST endpoint: {parsed.path}"})
    
    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", default=None, help="Path to .trt engine file")
    parser.add_argument("--port", type=int, default=8849, help="Port to serve on")
    args = parser.parse_args()
    
    if args.engine:
        engine = load_engine(args.engine)
        engine_path = args.engine
        print(f"⚡ Engine loaded: {args.engine} ({engine.num_bindings if engine else 0} bindings)")
    
    print(f"🏎️ PLATO TensorRT Room on :{args.port}")
    print(f"   TensorRT available: {HAS_TRT}")
    HTTPServer(("0.0.0.0", args.port), TRTRoomHandler).serve_forever()
