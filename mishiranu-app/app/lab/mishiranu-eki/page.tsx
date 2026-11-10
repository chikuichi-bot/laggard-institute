import MishiranuApp from "./MishiranuApp";

/**
 * Static-export friendly page. URL query (?view=&station=) is read
 * inside MishiranuApp on the client, so no server searchParams needed.
 */
export default function MishiranuEkiPage() {
  return <MishiranuApp />;
}
