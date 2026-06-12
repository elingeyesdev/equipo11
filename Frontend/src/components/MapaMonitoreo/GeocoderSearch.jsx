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
          <span className="geocoder-icon"><svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
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
                country: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
                region: '<svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>️',
                place: '<svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="8" height="20" x="8" y="2" rx="2" ry="2"/><path d="M4 10V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M20 22h2"/><path d="M2 22h2"/></svg>️',
                locality: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
                district: '<svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>️',
                address: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 13.47v4.53a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="M4 5l8 5.33L18 5"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>,
                poi: '⭐',
              };
              const icon = typeIcon[result.place_type?.[0]] || <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
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
