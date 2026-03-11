"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Terminal, 
  Github, 
  Star, 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown,
  Send,
  Trash2,
  Copy,
  Check,
  Menu,
  X,
  MessageSquare,
  Search,
  TestTube,
  Settings,
  Bot,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Types
type Mode = "ask" | "explain" | "test" | "generate"
type Status = "ready" | "loading" | "error"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface FileNode {
  name: string
  type: "file" | "folder"
  path?: string
  children?: FileNode[]
  expanded?: boolean
}

interface RepoInfo {
  name: string
  owner: string
  avatar: string
  stars: number
  language: string
  description: string
}

const suggestionChips = [
  "How does auth work?",
  "Explain the main entry point",
  "Generate tests for utils",
  "What does this repo do?"
]

const modeConfig: Record<Mode, { icon: React.ReactNode; label: string; color: string }> = {
  ask: { icon: <MessageSquare className="h-4 w-4" />, label: "Ask", color: "#58a6ff" },
  explain: { icon: <Search className="h-4 w-4" />, label: "Explain", color: "#3fb950" },
  test: { icon: <TestTube className="h-4 w-4" />, label: "Test", color: "#f0883e" },
  generate: { icon: <Settings className="h-4 w-4" />, label: "Generate", color: "#a371f7" },
}

// Code block component with copy functionality
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-3 rounded-lg overflow-hidden" style={{ backgroundColor: "#1e2430" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363d]">
        <span className="text-xs font-mono text-[#8b949e]">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-[#e6edf3]">{code}</code>
      </pre>
    </div>
  )
}

// Simple markdown renderer
function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/)
          if (match) {
            return <CodeBlock key={i} language={match[1] || "plaintext"} code={match[2].trim()} />
          }
        }
        
        // Process inline markdown
        const lines = part.split("\n").filter(line => line.trim())
        return lines.map((line, j) => {
          // Bold text
          let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#e6edf3]">$1</strong>')
          // Inline code
          processed = processed.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-sm font-mono" style="background-color: #1e2430">$1</code>')
          // Bullet points
          if (line.trim().startsWith("- ")) {
            return (
              <div key={`${i}-${j}`} className="flex gap-2 text-[#e6edf3]">
                <span className="text-[#58a6ff]">•</span>
                <span dangerouslySetInnerHTML={{ __html: processed.replace(/^-\s*/, "") }} />
              </div>
            )
          }
          
          return (
            <p 
              key={`${i}-${j}`} 
              className="text-[#e6edf3] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: processed }}
            />
          )
        })
      })}
    </div>
  )
}

// File tree component
function FileTreeItem({ 
  node, 
  depth = 0, 
  selectedFile, 
  onSelect, 
  onToggle 
}: { 
  node: FileNode
  depth?: number
  selectedFile: string | null
  onSelect: (name: string) => void
  onToggle: (name: string) => void
}) {
  const isFolder = node.type === "folder"
  const isSelected = selectedFile === (node.path ?? node.name)
  
  return (
    <div>
      <button
        onClick={() => isFolder ? onToggle(node.name) : onSelect(node.path ?? node.name)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
          "hover:bg-[#21262d]",
          isSelected && "bg-[#21262d] text-[#58a6ff]"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          <>
            {node.expanded ? (
              <ChevronDown className="h-4 w-4 text-[#8b949e]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#8b949e]" />
            )}
            <Folder className="h-4 w-4 text-[#58a6ff]" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 text-[#8b949e]" />
          </>
        )}
        <span className={cn("truncate", isSelected ? "text-[#58a6ff]" : "text-[#e6edf3]")}>
          {node.name}
        </span>
      </button>
      {isFolder && node.expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeItem
              key={i}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-[#8b949e]">
      <Bot className="h-5 w-5" />
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-[#58a6ff] animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-sm">thinking...</span>
    </div>
  )
}

export default function DevAssistant() {
  const [repoUrl, setRepoUrl] = useState("")
  const [repoLoaded, setRepoLoaded] = useState(false)
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("ready")
  const [mode, setMode] = useState<Mode>("ask")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isTyping])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  const handleLoadRepo = async () => {
    if (!repoUrl.trim()) return
    setStatus("loading")
    try {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        return
      }
      setRepoInfo(data.repoInfo)
      setFileTree(data.fileTree)
      setRepoLoaded(true)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  const toggleFolder = (name: string) => {
    const toggleNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.name === name && node.type === "folder") {
          return { ...node, expanded: !node.expanded }
        }
        if (node.children) {
          return { ...node, children: toggleNode(node.children) }
        }
        return node
      })
    }
    setFileTree(toggleNode(fileTree))
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const question = input
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, question, mode, selectedFile }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: data.error ? `Error: ${data.error}` : data.content,
        timestamp: new Date()
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Failed to get a response. Please check your connection and try again.",
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    textareaRef.current?.focus()
  }

  const clearChat = () => {
    setMessages([])
  }

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "k"
    }
    return count.toString()
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "#0d1117" }}>
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-[#30363d]" style={{ backgroundColor: "#161b22" }}>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-[#58a6ff]" />
          <span className="font-semibold text-[#e6edf3]">Dev Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-[#e6edf3] hover:bg-[#21262d]"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Left Sidebar */}
      <aside 
        className={cn(
          "w-full lg:w-[30%] shrink-0 border-r border-[#30363d] flex flex-col",
          "lg:relative absolute inset-0 z-50 lg:z-auto",
          "transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ backgroundColor: "#161b22" }}
      >
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 p-4 border-b border-[#30363d]">
          <div className="p-2 rounded-lg bg-[#21262d]">
            <Terminal className="h-5 w-5 text-[#58a6ff]" />
          </div>
          <span className="font-semibold text-lg text-[#e6edf3]">Dev Assistant</span>
        </div>

        {/* Repo URL Input */}
        <div className="p-4 border-b border-[#30363d]">
          <label className="block text-sm font-medium text-[#8b949e] mb-2">
            GitHub Repository URL
          </label>
          <div className="flex gap-2">
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoadRepo()}
              placeholder="https://github.com/owner/repo"
              className="flex-1 bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58] focus-visible:ring-[#58a6ff]"
            />
            <Button
              onClick={handleLoadRepo}
              disabled={status === "loading"}
              className="bg-[#238636] hover:bg-[#2ea043] text-white border-0"
            >
              {status === "loading" ? "..." : "Load"}
            </Button>
          </div>
        </div>

        {/* Repo Info Card */}
        {repoLoaded && repoInfo && (
          <div className="p-4 border-b border-[#30363d]">
            <div className="rounded-lg border border-[#30363d] p-4" style={{ backgroundColor: "#0d1117" }}>
              <div className="flex items-center gap-3 mb-3">
                <img 
                  src={repoInfo.avatar} 
                  alt={repoInfo.owner}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <div className="font-semibold text-[#e6edf3]">{repoInfo.name}</div>
                  <div className="text-sm text-[#8b949e]">{repoInfo.owner}</div>
                </div>
              </div>
              <p className="text-sm text-[#8b949e] mb-3">{repoInfo.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[#8b949e]">
                  <Star className="h-4 w-4 text-[#e3b341]" />
                  <span className="text-sm">{formatStars(repoInfo.stars)}</span>
                </div>
                <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1f6feb] text-white">
                  {repoInfo.language}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-4">
          {!repoLoaded ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Github className="h-12 w-12 text-[#484f58] mb-4" />
              <p className="text-[#8b949e]">Enter a repo URL to get started</p>
            </div>
          ) : (
            <div>
              {fileTree.map((node, i) => (
                <FileTreeItem
                  key={i}
                  node={node}
                  selectedFile={selectedFile}
                  onSelect={setSelectedFile}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className="p-4 border-t border-[#30363d]">
          <div className="flex items-center gap-2">
            <span 
              className={cn(
                "w-2 h-2 rounded-full",
                status === "ready" && "bg-[#3fb950]",
                status === "loading" && "bg-[#e3b341] animate-pulse",
                status === "error" && "bg-[#f85149]"
              )}
            />
            <span className="text-sm text-[#8b949e] capitalize">
              {status === "loading" ? "Loading..." : status}
            </span>
          </div>
        </div>

        {/* Mobile close overlay */}
        {sidebarOpen && (
          <button 
            className="lg:hidden fixed inset-0 bg-black/50 -z-10"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}
      </aside>

      {/* Right Main Panel */}
      <main className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: "#0d1117" }}>
        {/* Mode Tabs & Clear Button */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex gap-1 p-1 rounded-lg bg-[#161b22]">
            {(Object.keys(modeConfig) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  mode === m 
                    ? "text-white" 
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
                )}
                style={mode === m ? { backgroundColor: modeConfig[m].color } : undefined}
              >
                {modeConfig[m].icon}
                <span className="hidden sm:inline">{modeConfig[m].label}</span>
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-[#8b949e] hover:text-[#f85149] hover:bg-[#21262d]"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Clear chat</span>
          </Button>
        </div>

        {/* Chat Container */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Bot className="h-16 w-16 text-[#30363d] mb-4" />
              <p className="text-[#8b949e] mb-6 text-center">
                Start a conversation or pick a suggestion below
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestionChips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(chip)}
                    className="px-4 py-2 rounded-full border border-[#30363d] text-sm text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#238636] flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-3",
                      message.role === "user"
                        ? "bg-[#1f6feb] text-white"
                        : "bg-[#161b22] border border-[#30363d]"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <MarkdownContent content={message.content} />
                    ) : (
                      <p className="text-white">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#21262d] flex items-center justify-center">
                      <User className="h-4 w-4 text-[#8b949e]" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 animate-in fade-in duration-300">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#238636] flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#30363d]">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={`Ask about the codebase...`}
                rows={1}
                className="w-full resize-none rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3 pr-12 text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:border-transparent"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
              <div className="absolute right-3 bottom-3 text-xs text-[#484f58]">
                {modeConfig[mode].label}
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="h-12 w-12 rounded-lg bg-[#58a6ff] hover:bg-[#79b8ff] text-white disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
