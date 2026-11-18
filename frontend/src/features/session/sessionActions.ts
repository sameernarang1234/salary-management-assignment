import { createAction } from '@reduxjs/toolkit';

/** Dispatched when the API answers 401 to a signed-in request. */
export const sessionExpired = createAction('session/expired');
