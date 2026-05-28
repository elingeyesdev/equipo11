import { useState, useEffect } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'envirosense-offline';
const DB_VERSION = 1;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('api-cache');
    }
  });
}

export default function useOfflineData(endpoint) {
  const [data, setData] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(endpoint);
        const json = await res.json();
        setData(json);
        
        const db = await getDB();
        await db.put('api-cache', json, endpoint);
      } catch {
        const db = await getDB();
        const cached = await db.get('api-cache', endpoint);
        if (cached) setData(cached);
      }
    };
    
    fetchData();
  }, [endpoint]);

  return { data, isOffline };
}
