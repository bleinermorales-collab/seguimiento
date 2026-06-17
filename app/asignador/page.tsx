import { redirect } from 'next/navigation';

// This route has been renamed to /coordinador
export default function AsignadorRedirect() {
  redirect('/coordinador');
}
