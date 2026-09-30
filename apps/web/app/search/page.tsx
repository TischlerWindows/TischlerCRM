import SearchResultsPage from './search-results-page';

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  return <SearchResultsPage query={typeof searchParams.q === 'string' ? searchParams.q : ''} />;
}