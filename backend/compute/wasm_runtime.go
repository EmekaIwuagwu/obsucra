package compute

import (
	"context"
	"fmt"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// WasmRuntime handles the execution of serverless functions in a WASM sandbox.
type WasmRuntime struct {
	runtime wazero.Runtime
}

func NewWasmRuntime() *WasmRuntime {
	ctx := context.Background()
	r := wazero.NewRuntime(ctx)
	
	// Instantiate WASI
	wasi_snapshot_preview1.MustInstantiate(ctx, r)
	
	return &WasmRuntime{
		runtime: r,
	}
}

// ExecuteComputeFunc runs a WASM binary or simulates execution if buffer is empty.
func (r *WasmRuntime) ExecuteComputeFunc(wasmBuffer []byte) (string, error) {
	if len(wasmBuffer) == 0 {
		// Mock execution for demo/orchestration
		return "42.0", nil
	}

	ctx := context.Background()
	
	// Instantiate the module
	mod, err := r.runtime.Instantiate(ctx, wasmBuffer)
	if err != nil {
		return "", fmt.Errorf("failed to instantiate module: %v", err)
	}
	defer mod.Close(ctx)

	// Call the "run" function
	runFunc := mod.ExportedFunction("run")
	if runFunc == nil {
		return "", fmt.Errorf("module does not export 'run' function")
	}

	results, err := runFunc.Call(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to call run function: %v", err)
	}
	
	if len(results) > 0 {
		return fmt.Sprintf("%v", results[0]), nil
	}

	return "success", nil
}
