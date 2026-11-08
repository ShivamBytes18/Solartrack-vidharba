import { Link } from 'react-router-dom';

const STEPS = [
  ['Answer a few questions', 'Owner or tenant, your roof, and your monthly bill. It takes about a minute.'],
  ['Upload your bill', 'We read it for you, and you check every value beside the photo before anything is saved.'],
  ['See your result', 'A suggested system size, and whether we visit your roof or call you first.'],
];

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <h1>Find out in a minute if solar suits your home</h1>
        <p className="lede">Company A Solar installs rooftop solar for homes and small businesses across Vidarbha. Share your electricity bill and we will tell you what size fits and what it could save.</p>
        <Link className="btn" to="/check">Check my home</Link>
      </section>

      <section aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="how">
          {STEPS.map(([title, text], i) => (
            <li key={title}><span className="num-lg" aria-hidden>{i + 1}</span><h3>{title}</h3><p className="muted">{text}</p></li>
          ))}
        </ol>
      </section>

      <section className="panel fair">
        <h2>Fair by design</h2>
        <p>AI helps read your bill, but you always confirm the numbers. A small bill or a rented home is never turned away: we simply call you instead of visiting, and tell you honestly what will work.</p>
        <p className="muted" style={{ margin: 0 }}>We use your details only to assess solar for your home. You can ask us to delete them at any time.</p>
      </section>

      <section className="cta">
        <Link className="btn" to="/check">Check my home</Link>
        <Link className="btn ghost" to="/staff/login">Staff sign in</Link>
      </section>
    </main>
  );
}
