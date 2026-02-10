import { useStore } from '@nanostores/react';
import { VirtuosoMasonry, type ItemContent } from '@virtuoso.dev/masonry';
import { useEffect, useMemo, useState } from 'react';
import { randomTrigger, searchQuery } from '../lib/gridStore';
import type { GameItem } from '../types';

/**
 * Hook: Calculate Window Width for Responsive Columns
 */
function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1200;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

/**
 * Component: Single Item Card
 */
const ItemCard: ItemContent<GameItem, unknown> = ({ data: item }) => {
  return (
    // Wrapper div required for gutter spacing in Masonry
    <div style={{ paddingBottom: '30px', paddingRight: '15px', paddingLeft: '15px' }}>
      <figure
        className="collection-card-react"
        style={{
          ...item.style,
          background: item.background || '#222'
        }}
      >
        <a href={item.href} aria-label={`Open ${item.label}`}>
          {item.imageSrc ? (
            <img
              src={item.imageSrc.src}
              srcSet={item.imageSrc.srcSet?.attribute}
              width={item.width || 200}
              height={item.height || 'auto'}
              alt={item.label}
              loading="lazy"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: item.objectFit || 'cover',
                aspectRatio: item.aspectRatio || 'auto'
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                minHeight: '170px',
                background: '#333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span>No Image</span>
            </div>
          )}
        </a>

        <figcaption className="label game-name" style={{ fontFamily: 'var(--font-poppins)' }}>
          {item.label}
        </figcaption>
      </figure>
    </div>
  );
};

interface GameGridProps {
  items: GameItem[];
}

/**
 * Main Grid Component
 */
export default function GameGrid({ items }: GameGridProps) {
  const $searchQuery = useStore(searchQuery);
  const $randomTrigger = useStore(randomTrigger);
  const windowWidth = useWindowWidth();

  // 1. Filter Logic
  const visibleItems = useMemo(() => {
    const term = $searchQuery.toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.label.toLowerCase().includes(term));
  }, [items, $searchQuery]);

  // 2. Responsive Column Count
  const columnCount = useMemo(() => {
    if (windowWidth < 600) return 2;
    if (windowWidth < 900) return 3;
    if (windowWidth < 1200) return 4;
    return 5;
  }, [windowWidth]);

  // 3. Random Button Logic
  useEffect(() => {
    if ($randomTrigger > 0 && visibleItems.length > 0) {
      const randomIndex = Math.floor(Math.random() * visibleItems.length);
      const target = visibleItems[randomIndex];
      if (target?.href) {
        window.location.href = target.href;
      }
    }
  }, [$randomTrigger, visibleItems]);

  return <VirtuosoMasonry useWindowScroll data={visibleItems} columnCount={columnCount} ItemContent={ItemCard} />;
}
