import { useStore } from './store/useStore';

export default function App() {
  const areas = useStore(state => state.areas);
  return <main className="foundation"><span className="mark">w.</span><p>YOUR SPACE</p><h1>Good morning.</h1><span>Your workflow starts here.</span><section>{areas.map(area => <article key={area.id} style={{ borderColor: area.color }}>{area.icon}　{area.name}</article>)}</section></main>;
}
