import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'properties',
    renderMode: RenderMode.Client,
  },
  {
    path: 'properties/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth',
    renderMode: RenderMode.Client,
  },
  {
    path: 'login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'host/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'checkout/:bookingId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'user/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'checkout/callback',
    renderMode: RenderMode.Client,
  },
  {
    path: 'receipt/:bookingId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'chat/:bookingId/:otherParticipantId',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
