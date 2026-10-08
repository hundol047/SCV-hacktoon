'use client';
import {createContext,useContext} from 'react';
import {demoCatalog,indexCatalog} from '../data/catalog';
export const CatalogContext=createContext(demoCatalog);
export function useCatalog(){const catalog=useContext(CatalogContext);return {...indexCatalog(catalog),catalog,places:catalog.places};}
