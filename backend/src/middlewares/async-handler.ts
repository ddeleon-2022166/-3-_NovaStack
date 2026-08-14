import { NextFunction, Request, Response } from "express";

// Express 4 no captura automaticamente los errores lanzados dentro de
// controladores async. Este helper envuelve el controlador y reenvia
// cualquier error al middleware centralizado de errores (next(err)).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
