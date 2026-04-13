import { useState, useEffect } from 'react';
import { Concept } from '../types/concept';
import { Style, styleCategories } from '../data/mockStyles';
import * as conceptService from '../services/conceptService';

export function useConcepts() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [conceptsRes, stylesRes] = await Promise.all([
        conceptService.getConcepts(),
        conceptService.getStyles(),
      ]);
      setConcepts(conceptsRes.concepts);
      setStyles(stylesRes.styles as Style[]);
    } catch (err) {
      console.error('Failed to load concepts/styles:', err);
    } finally {
      setLoading(false);
    }
  };

  return { concepts, styles, styleCategories, loading };
}
