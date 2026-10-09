/** Refuse to resolve `typescript`, exactly as an install without dev dependencies would. */
export async function resolve(specifier, context, next) {
  if (specifier === "typescript") {
    const e = new Error("Cannot find package 'typescript'");
    e.code = "ERR_MODULE_NOT_FOUND";
    throw e;
  }
  return next(specifier, context);
}
