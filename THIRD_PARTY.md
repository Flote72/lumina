# Third-party components

| Component | Use | License |
|---|---|---|
| React, Zustand, Dexie, exifr, fflate, @tanstack/react-virtual | app runtime | MIT |
| Tailwind CSS, Vite | build / styling | MIT |
| Pretendard, Inter (self-hosted fonts) | UI typography | SIL OFL 1.1 |
| `libraw-wasm` (wrapper, ISC) around **LibRaw** | RAW decoding | LibRaw: LGPL-2.1 / CDDL-1.0 dual licence |
| `onnxruntime-web` | runs the AI subject model in the browser | MIT |
| **U²-Net-P** (`public/models/u2netp.onnx`, from the rembg release) | AI subject mask | Apache-2.0 (Xuebin Qin et al., "U²-Net", Pattern Recognition 2020) |

LibRaw is used unmodified through its WebAssembly build; if you redistribute Lumina, keep this notice and provide
the LibRaw source / licence texts as required by the LGPL / CDDL.
