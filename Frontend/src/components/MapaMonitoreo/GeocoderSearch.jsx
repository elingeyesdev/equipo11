import { useRef, useEffect } from 'react';
import Draggable from '../Draggable/Draggable';
import './GeocoderSearch.css';

function GeocoderSearch({
  MAPBOX_TOKEN,
  searchQuery,
  setSearchQuery,
  showResults,
  setShowResults,
  searchResults,
  setSearchResults,
  isSearching,
  setIsSearching,
  onSelectResult
}) {
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowResults]);

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=6&language=es`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowResults(true);
      } catch (err) {
        console.error('Error en geocoding:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const handleResultClick = (result) => {
    setSearchQuery(result.place_name || result.text);
    setShowResults(false);
    onSelectResult(result);
  };

  return (
    <Draggable className="geocoder-search-container">
      <div ref={searchRef}>
        <div className="geocoder-input-wrapper">
          <span className="geocoder-icon">🔍</span>
          <input
            id="geocoder-search-input"
            type="text"
            className="geocoder-input"
            placeholder="Buscar país, ciudad o lugar…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleClearSearch();
                e.target.blur();
              }
            }}
            autoComplete="off"
          />
          {searchQuery && (
            <button className="geocoder-clear-btn" onClick={handleClearSearch} aria-label="Limpiar búsqueda">
              ×
            </button>
          )}
        </div>

        {showResults && (
          <ul className="geocoder-results-list">
            {isSearching && (
              <li className="geocoder-result-item geocoder-loading">Buscando…</li>
            )}
            {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
              <li className="geocoder-result-item geocoder-no-results">Sin resultados</li>
            )}
            {!isSearching && searchResults.map((result) => {
              const typeIcon = {
                country: '🌍',
                region: '🏔️',
                place: '🏙️',
                locality: '📍',
                district: '🏘️',
                address: '📫',
                poi: '⭐',
              };
              const icon = typeIcon[result.place_type?.[0]] || '📍';
              return (
                <li
                  key={result.id}
                  className="geocoder-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <span className="geocoder-result-icon">{icon}</span>
                  <div className="geocoder-result-text">
                    <span className="geocoder-result-name">{result.text}</span>
                    {result.place_name !== result.text && (
                      <span className="geocoder-result-context">
                        {result.place_name?.replace(`${result.text}, `, '')}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Draggable>
  );
}

export default GeocoderSearch;
