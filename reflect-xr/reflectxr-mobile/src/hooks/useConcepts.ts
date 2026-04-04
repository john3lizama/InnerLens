import { useState, useEffect } from 'react';
import { Concept } from '../types/concept';
import { mockConcepts } from '../data/mockConcepts';
import { mockStyles, Style, styleCategories } from '../data/mockStyles';

const USE_MOCK = true;

export function useConcepts() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (USE_MOCK) {
      setConcepts(mockConcepts);
      setStyles(mockStyles);
      setLoading(false);
      return;
    }
    // TODO: call conceptService.getConcepts() and conceptService.getStyles()
  };

  return { concepts, styles, styleCategories, loading };
}
