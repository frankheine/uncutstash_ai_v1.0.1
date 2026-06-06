// src/rag/ingestion.ts
export interface TextChunk {
    id: string;
    text: string;
}

/**
 * Basic Recursive Character Text Splitter
 */
export function recursiveCharacterSplit(
    text: string,
    chunkSize: number = 500,
    chunkOverlap: number = 50,
    separators: string[] = ['\n\n', '\n', ' ', '']
): string[] {
    const chunks: string[] = [];
    
    function splitText(textToSplit: string, separatorIndex: number) {
        if (textToSplit.length <= chunkSize) {
            if (textToSplit.trim().length > 0) {
                chunks.push(textToSplit.trim());
            }
            return;
        }

        if (separatorIndex >= separators.length) {
            // Fallback: chunk by absolute character limit if no separators apply
            for (let i = 0; i < textToSplit.length; i += (chunkSize - chunkOverlap)) {
                chunks.push(textToSplit.substring(i, i + chunkSize).trim());
            }
            return;
        }

        const separator = separators[separatorIndex];
        const splits = textToSplit.split(separator);

        let currentChunk = '';
        for (const split of splits) {
            const nextChunk = currentChunk ? currentChunk + separator + split : split;
            if (nextChunk.length <= chunkSize) {
                currentChunk = nextChunk;
            } else {
                if (currentChunk.trim().length > 0) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = split; // Start new chunk
            }
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
    }

    splitText(text, 0);
    return chunks;
}
