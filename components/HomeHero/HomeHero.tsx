// components/HomeHero/HomeHero.tsx
import styles from './HomeHero.module.css';

export default function HomeHero({ children }: { children?: React.ReactNode }) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        {/* Your existing headline + copy + buttons go here */}
        {children}
      </div>
    </section>
  );
}

