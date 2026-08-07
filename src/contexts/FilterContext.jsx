import { createContext, useState, useContext, useEffect } from 'react';
import { get } from 'idb-keyval';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const fetchDefault = async () => {
      try {
        const val = await get('default_file');
        if (val) {
          setSelectedFile(val);
        }
      } catch (e) {
        console.error("Failed to load default file", e);
      }
    };
    fetchDefault();
  }, []);

  return (
    <FilterContext.Provider value={{ selectedFile, setSelectedFile }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
