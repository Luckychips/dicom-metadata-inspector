import type { DicomSearchPathSegment, DicomSearchResponse } from '@/cores';

export interface MetadataSearchResultsProps {
    result: DicomSearchResponse;
}

const formatPath = (path: readonly DicomSearchPathSegment[]): string => {
    if (path.length === 0) {
        return '-';
    }

    return path.map(segment => {
        const name = segment.keyword ?? segment.tag;
        return (`${name}` + `[${segment.itemIndex}]`);
    }).join(' → ');
};

const formatFileSize = (file: File): string => {
    const bytes = file.size;
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return (`${(bytes / 1024).toFixed(1)} KB`);
    }

    return (`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
};

export const MetadataSearchResults = ({ result }: MetadataSearchResultsProps) => {
    if (result.results.length === 0) {
        return (
            <div>
                <p>
                    No metadata matched
                    &quot;{result.query}&quot;.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div>
                <strong>{result.results.length}</strong>
                {' results'}
                {result.truncated && (
                    <span>
                        {' '}
                        (result limit
                        reached)
                    </span>
                )}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                    <tr>
                        <th>File</th>
                        <th>Tag</th>
                        <th>Name</th>
                        <th>Keyword</th>
                        <th>VR</th>
                        <th>Value</th>
                        <th>Matched</th>
                        <th>Path</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.results.map((item, index) => (
                        <tr key={`${item.fileId}-${item.element.tag}-${index}`}>
                            <td>
                                <div>{item.file.name}</div>
                                <small>{formatFileSize(item.file)}</small>
                            </td>
                            <td>
                                <code>{item.element.formattedTag}</code>
                            </td>
                            <td>{item.element.name ?? '-'}</td>
                            <td>{item.element.keyword ?? '-'}</td>
                            <td>{item.element.vr ?? '-'}</td>
                            <td>
                                <MetadataValue value={item.displayValue} />
                            </td>
                            <td>{item.matchedFields.join(', ')}</td>
                            <td>{formatPath(item.path)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface MetadataValueProps {
    value: string | null;
}

const MetadataValue = ({value,}: MetadataValueProps) => {
    if (value === null) {
        return <span>-</span>;
    }

    return (
        <span
            title={value}
            style={{
                display: 'inline-block',
                maxWidth: '400px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
            }}>
            {value}
        </span>
    );
};
