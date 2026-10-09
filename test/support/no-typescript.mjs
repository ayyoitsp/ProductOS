/**
 * Make `typescript` genuinely unresolvable, the way the runtime image has it.
 *
 * ⛔ A GREP CANNOT PROVE THIS. The defect was module resolution failing before any code ran, so the
 * only faithful check is to ask node to load the CLI with the package actually absent.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("no-typescript-hooks.mjs", import.meta.url).pathname));
