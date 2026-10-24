export interface DiffToken {
  type: 'same' | 'added' | 'removed';
  text: string;
}

/**
 * Word-level LCS diff between beforeText and afterText
 * Used in the Mentor Reflection History Comparison View
 */
export function computeWordDiff(beforeText: string, afterText: string): DiffToken[] {
  const a = (beforeText || '').trim().split(/(\s+)/).filter(Boolean);
  const b = (afterText || '').trim().split(/(\s+)/).filter(Boolean);

  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      result.push({ type: 'added', text: b[j] });
      j++;
    }
  }

  while (i < m) {
    result.push({ type: 'removed', text: a[i++] });
  }
  while (j < n) {
    result.push({ type: 'added', text: b[j++] });
  }

  return result;
}
