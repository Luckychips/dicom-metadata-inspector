import { useMemo, useState } from 'react';
import {
    searchDicomFiles,
    type DicomGroupingResult,
    type DicomSearchField,
} from '@/cores';
import { MetadataSearchResults } from '@/components';

export interface MetadataSearchProps {
    grouping: DicomGroupingResult | null;
}

const SEARCH_FIELDS: {
    value: DicomSearchField;
    label: string;
}[] = [
    {
        value: 'tag',
        label: 'Tag',
    },
    {
        value: 'keyword',
        label: 'Keyword',
    },
    {
        value: 'name',
        label: 'Name',
    },
    {
        value: 'value',
        label: 'Value',
    },
    {
        value: 'vr',
        label: 'VR',
    },
];

export const MetadataSearch = ({ grouping }: MetadataSearchProps) => {
    const [query, setQuery] = useState('');
    const [fields, setFields] = useState<DicomSearchField[]>(SEARCH_FIELDS.map(item => item.value));
    const [recursive, setRecursive] = useState(true);
    const searchResult = useMemo(() => {
        if (!grouping || query.trim() === '') {
            return null;
        }

        if (fields.length === 0) {
            return null;
        }

        return searchDicomFiles(grouping, query, {
            fields,
            recursive,
            caseSensitive: false,
            maxResults: 1000,
        });
    }, [grouping, query, fields, recursive]);

    const handleFieldChange = (field: DicomSearchField) => {
        setFields(current => {
            if (current.includes(field)) {
                return current.filter(item => item !== field);
            }

            return [...current, field];
        });
    };

    const handleClear = () => {
        setQuery('');
    };

    if (!grouping) {
        return (
            <section>
                <h2>Metadata Search</h2>
                <p>
                    No DICOM files are
                    available for search.
                </p>
            </section>
        );
    }

    return (
        <section>
            <h2>Metadata Search</h2>
            <div>
                <input
                    type="search"
                    value={query}
                    placeholder={'Tag, keyword, name, value...'}
                    aria-label={'Search DICOM metadata'}
                    onChange={event => setQuery(event.target.value)} />
                {query !== '' && <button type="button" onClick={handleClear}>Clear</button>}
            </div>
            <div>
                {SEARCH_FIELDS.map(field => (
                    <label key={field.value}>
                        <input
                            type="checkbox"
                            checked={fields.includes(field.value)}
                            onChange={() => handleFieldChange(field.value)} />
                        {field.label}
                    </label>
                ))}
                <label>
                    <input
                        type="checkbox"
                        checked={recursive}
                        onChange={
                            event => setRecursive(event.target.checked)
                        } />
                    Search sequences
                </label>
            </div>
            {fields.length === 0 && (
                <p>
                    Select at least one
                    search field.
                </p>
            )}
            {query.trim() !== '' && searchResult && <MetadataSearchResults result={searchResult} />}
        </section>
    );
};
