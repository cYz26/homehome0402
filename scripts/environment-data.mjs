import fs from 'node:fs/promises';
import {presentationEnvironment} from '../src/presentation-environment.js';
const spec=JSON.parse(await fs.readFile(new URL('../model/apartment.json',import.meta.url)));
process.stdout.write(JSON.stringify(presentationEnvironment(spec.presentationEnvironment)));
