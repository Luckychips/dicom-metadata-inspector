import type { DicomSearchResponse } from '@/cores';
import { getFileSize, getFullTags } from '@/cores';

interface Props {
    result: DicomSearchResponse;
}

const MetadataSearchResults = ({ result }: Props) => {
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
                                <small>{getFileSize(item.file)}</small>
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
                            <td>{getFullTags(item.path)}</td>
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

export default MetadataSearchResults;
