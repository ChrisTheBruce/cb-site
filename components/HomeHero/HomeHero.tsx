// components/HomeHero.tsx
import styles from './HomeHero.module.css';

export default function HomeHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.overlay}/>
      {/* Your existing header content */}
      <div className={styles.content}>
        {/* keep your existing H1, buttons, etc. */}
      </div>
    </section>
  );
}
