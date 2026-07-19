/**
 * 把 rule 产物渲染成安装形态。scope 是管理元数据（meta frontmatter / catalog），
 * 不在产物内：scoped 规则在拼装时于此获得 paths frontmatter，global 规则原样落地。
 * 字节格式必须保持稳定——下游 lock 对渲染后内容取 hash。
 */
export function renderRule(scope: string | null, content: string): string {
  if (scope === null || scope === 'global') return content
  return `---\npaths:\n  - "${scope}"\n---\n\n${content}`
}
