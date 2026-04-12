import { redirect } from 'next/navigation';

export default function ContactRequestsPage() {
  redirect('/inbox?view=requests');
}
