// Imported FIRST in App.tsx: ES imports run in order, so the error handlers
// are in place before any other module (navigation, push setup) runs its
// top-level code. An error there is then caught and reported instead of
// closing the app before anything is on screen.
import { installGlobalErrorHandlers } from './crashReporter';

installGlobalErrorHandlers();
