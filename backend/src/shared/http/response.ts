export function success(data: any, message: string | null = null) {
  return {
    success: true,
    data,
    message,
  };
}

export function error(message: string) {
  return {
    success: false,
    data: null,
    message,
  };
}
