import { useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import type { HuffmanTable, HuffmanTableEntry } from "@/services/huffmanApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HuffmanTreeVisualizerProps {
  table: HuffmanTable | null;
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  } | null;
}

interface TreeNode {
  symbol?: number;
  code: string;
  count: number;
  children?: [TreeNode, TreeNode];
  depth: number;
  x: number;
  y: number;
  width: number;
}

export function HuffmanTreeVisualizer({
  table,
  decodedResult,
}: HuffmanTreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, systemTheme } = useTheme();
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);

  // Build tree structure
  const tree = useMemo(() => {
    if (!table?.entries) return null;

    const root: TreeNode = { 
      code: "", 
      count: 0, 
      depth: 0, 
      x: 0, 
      y: 0, 
      width: 0 
    };
    
    // Find max depth
    let maxDepth = 0;
    table.entries.forEach((entry) => {
      maxDepth = Math.max(maxDepth, entry.code_length);
    });

    // Build tree
    table.entries.forEach((entry) => {
      let node = root;
      const code = entry.code;
      
      for (let i = 0; i < code.length; i++) {
        const bit = code[i];
        if (!node.children) {
          node.children = [
            { code: node.code + "0", count: 0, depth: node.depth + 1, x: 0, y: 0, width: 0 },
            { code: node.code + "1", count: 0, depth: node.depth + 1, x: 0, y: 0, width: 0 },
          ];
        }
        node = bit === "0" ? node.children[0] : node.children[1];
      }
      
      node.symbol = entry.symbol;
      node.count = decodedResult?.symbols.filter(s => s === entry.symbol).length || 0;
    });

    // Calculate layout
    const nodeRadius = 22;
    const levelHeight = 70;
    const minNodeSpacing = 50;

    // First pass: calculate width needed for each subtree
    const calculateWidth = (node: TreeNode): number => {
      if (!node.children) {
        // Leaf node
        node.width = minNodeSpacing;
        return node.width;
      }
      
      const leftWidth = calculateWidth(node.children[0]);
      const rightWidth = calculateWidth(node.children[1]);
      node.width = leftWidth + rightWidth;
      return node.width;
    };

    // Second pass: assign positions
    const assignPositions = (node: TreeNode, x: number, y: number) => {
      node.x = x;
      node.y = y;

      if (node.children) {
        const leftWidth = node.children[0].width;
        const rightWidth = node.children[1].width;
        const totalWidth = leftWidth + rightWidth;
        
        // Position children
        assignPositions(node.children[0], x - totalWidth / 4, y + levelHeight);
        assignPositions(node.children[1], x + totalWidth / 4, y + levelHeight);
      }
    };

    calculateWidth(root);
    
    // Center the root
    const canvasWidth = Math.max(800, root.width + 100);
    assignPositions(root, canvasWidth / 2, 50);

    return { root, maxDepth, canvasWidth, canvasHeight: (maxDepth + 1) * levelHeight + 100 };
  }, [table, decodedResult]);

  // Render SVG tree
  const renderTree = () => {
    if (!tree) return null;

    const effectiveTheme = theme === "system" ? systemTheme : theme;
    const isDark = effectiveTheme === "dark";

    const colors = {
      bg: isDark ? "#0a0a0a" : "#ffffff",
      node: isDark ? "#374151" : "#e5e7eb",
      nodeBorder: isDark ? "#6b7280" : "#9ca3af",
      leafBorder: isDark ? "#10b981" : "#059669",
      line: isDark ? "#4b5563" : "#d1d5db",
      text: isDark ? "#f3f4f6" : "#1f2937",
    };

    const renderNode = (node: TreeNode): JSX.Element => {
      const isLeaf = !node.children;
      const radius = isLeaf ? 20 : 15;
      const hue = isLeaf && node.symbol !== undefined ? (node.symbol * 137) % 360 : 0;
      const fillColor = isLeaf && node.symbol !== undefined 
        ? `hsla(${hue}, 70%, 60%, 0.8)` 
        : colors.node;

      return (
        <g key={node.code || "root"}
           onMouseEnter={() => setHoveredNode(node)}
           onMouseLeave={() => setHoveredNode(null)}
           style={{ cursor: 'pointer' }}
        >
          {/* Draw connection to children first (so lines are behind nodes) */}
          {node.children?.map((child, index) => (
            <g key={`line-${index}`}>
              <line
                x1={node.x}
                y1={node.y}
                x2={child.x}
                y2={child.y}
                stroke={colors.line}
                strokeWidth={2}
              />
              {/* Bit label */}
              <text
                x={(node.x + child.x) / 2}
                y={(node.y + child.y) / 2 - 5}
                fill={colors.text}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
              >
                {index.toString()}
              </text>
            </g>
          ))}

          {/* Draw node circle */}
          <circle
            cx={node.x}
            cy={node.y}
            r={radius}
            fill={fillColor}
            stroke={isLeaf ? colors.leafBorder : colors.nodeBorder}
            strokeWidth={2}
          />

          {/* Draw label */}
          <text
            x={node.x}
            y={node.y}
            fill={isLeaf && node.symbol !== undefined ? (isDark ? "#000" : "#fff") : colors.text}
            fontSize={isLeaf ? 11 : 10}
            fontWeight={isLeaf ? "bold" : "normal"}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {isLeaf && node.symbol !== undefined ? node.symbol.toString() : "·"}
          </text>
        </g>
      );
    };

    const collectNodes = (node: TreeNode, nodes: TreeNode[] = []): TreeNode[] => {
      nodes.push(node);
      if (node.children) {
        collectNodes(node.children[0], nodes);
        collectNodes(node.children[1], nodes);
      }
      return nodes;
    };

    const allNodes = collectNodes(tree.root);

    return (
      <div className="w-full overflow-auto">
        <svg
          width={tree.canvasWidth}
          height={tree.canvasHeight}
          style={{ 
            backgroundColor: colors.bg,
            minWidth: '100%',
            minHeight: '100%'
          }}
        >
          {allNodes.map(renderNode)}
        </svg>
      </div>
    );
  };

  if (!table) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <p>Select a Huffman table to visualize</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Huffman Tree</CardTitle>
          <div className="flex gap-2">
            {tree && (
              <Badge variant="outline">
                Depth: {tree.maxDepth}
              </Badge>
            )}
            {decodedResult && (
              <Badge variant="secondary">
                {decodedResult.symbols.length} symbols
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 relative p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {renderTree()}
        </ScrollArea>
        
        {hoveredNode && (
          <div className="absolute top-4 right-4 bg-popover border rounded-lg shadow-lg p-3 text-xs z-10">
            {hoveredNode.symbol !== undefined ? (
              <div className="space-y-1">
                <div className="font-semibold text-base">Symbol: {hoveredNode.symbol}</div>
                <div className="font-mono text-muted-foreground">Code: {hoveredNode.code}</div>
                <div className="text-muted-foreground">Length: {hoveredNode.code.length} bits</div>
                {hoveredNode.count > 0 && (
                  <div className="text-muted-foreground">Count: {hoveredNode.count}</div>
                )}
              </div>
            ) : (
              <div className="font-mono text-muted-foreground">
                Code prefix: {hoveredNode.code || "root"}
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/90 p-3 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Internal node</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsla(137, 70%, 60%, 0.8)' }} />
            <span>Leaf (symbol)</span>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Hover nodes for details • Scroll to pan
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
