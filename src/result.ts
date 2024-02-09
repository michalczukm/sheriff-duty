type OperationError<TError> = { code: TError };

export type OperationResult<TData = unknown, TError = unknown> =
	| {
		status: 'success';
		data: TData;
	}
	| {
			status: 'failure';
			errors: OperationError<TError>[];
			data?: TData;
	  };

export type OperationStatus = OperationResult['status'];

export function successResult<TData, TError>(data: TData): OperationResult<TData, TError> {
	return {
		status: 'success',
		data,
	} as const;
}

export const failureResult = <TData, TError>(errors: OperationError<TError>[] = [], data?: TData): OperationResult<TData, TError> => ({
	status: 'failure' as const,
	errors,
	data,
});
