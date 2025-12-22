package functions

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/rs/zerolog/log"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// ComputeManager handles WASM function execution
// Using wazero (Pure Go) instead of wasmtime-go for better portability/no-cgo,
// consistent with existing go.mod dependencies.
type ComputeManager struct {
	runtime wazero.Runtime
}

// NewComputeManager initializes the WASM runtime
func NewComputeManager(ctx context.Context) (*ComputeManager, error) {
	r := wazero.NewRuntime(ctx)
	
	// Instantiate WASI
	if _, err := wasi_snapshot_preview1.Instantiate(ctx, r); err != nil {
		return nil, err
	}

	return &ComputeManager{
		runtime: r,
	}, nil
}

// ExecuteWasm runs a WASM binary with input data
func (cm *ComputeManager) ExecuteWasm(ctx context.Context, wasmCode []byte, funcName string, params []uint64) ([]uint64, error) {
	log.Debug().Msg("Compiling and Executing WASM function")

	// Compile module
	mod, err := cm.runtime.CompileModule(ctx, wasmCode)
	if err != nil {
		return nil, fmt.Errorf("compile error: %w", err)
	}
	defer mod.Close(ctx)

	// Instantiate
	modConfig := wazero.NewModuleConfig().WithStdout(log.Logger).WithStderr(log.Logger)
	instance, err := cm.runtime.InstantiateModule(ctx, mod, modConfig)
	if err != nil {
		return nil, fmt.Errorf("instantiate error: %w", err)
	}
	defer instance.Close(ctx)

	// Export function
	f := instance.ExportedFunction(funcName)
	if f == nil {
		return nil, fmt.Errorf("function %s not found", funcName)
	}

	// Call
	results, err := f.Call(ctx, params...)
	if err != nil {
		return nil, fmt.Errorf("execution error: %w", err)
	}

	return results, nil
}

// Close cleans up resources
func (cm *ComputeManager) Close(ctx context.Context) {
	cm.runtime.Close(ctx)
}
