"use client"

import type { CustomDomainModel } from "@chatbotx.io/database/types"
import { Badge } from "@chatbotx.io/ui/components/ui/badge"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import { Label } from "@chatbotx.io/ui/components/ui/label"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { CheckCircle2Icon, CopyIcon, GlobeIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  deleteCustomDomainAction,
  upsertCustomDomainAction,
  verifyCustomDomainAction,
} from "./custom-domain.action"
import {
  type UpsertCustomDomainSchema,
  upsertCustomDomainSchema,
} from "./schema"

interface Props {
  domain: CustomDomainModel | null | undefined
  brokerHost?: string
}

export function CustomDomainSettings({ domain, brokerHost }: Props) {
  const router = useRouter()

  const form = useForm<UpsertCustomDomainSchema>({
    resolver: zodResolver(upsertCustomDomainSchema),
    defaultValues: {
      domain: domain?.domain ?? "",
    },
  })

  const { execute: executeUpsert, isPending: isUpserting } = useAction(
    upsertCustomDomainAction,
    {
      onSuccess: () => {
        toast.success("Domínio salvo com sucesso!")
        router.refresh()
      },
      onError: ({ error }) => {
        toast.error(error.serverError || "Erro ao salvar o domínio.")
      },
    },
  )

  const { execute: executeVerify, isPending: isVerifying } = useAction(
    verifyCustomDomainAction,
    {
      onSuccess: () => {
        toast.success("Domínio verificado e ativado com sucesso!")
        router.refresh()
      },
      onError: ({ error }) => {
        toast.error(error.serverError || "Não foi possível verificar o domínio.")
      },
    },
  )

  const { execute: executeDelete, isPending: isDeleting } = useAction(
    deleteCustomDomainAction,
    {
      onSuccess: () => {
        toast.success("Domínio removido.")
        form.reset({ domain: "" })
        router.refresh()
      },
      onError: ({ error }) => {
        toast.error(error.serverError || "Erro ao remover o domínio.")
      },
    },
  )

  const onSubmit = form.handleSubmit((data) => {
    executeUpsert(data)
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copiado para a área de transferência!")
  }

  const cnameTarget =
    brokerHost ||
    (typeof window !== "undefined" ? window.location.hostname : "app.seusistema.com.br")

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <GlobeIcon className="size-5 text-primary" />
                Domínio Personalizado
              </CardTitle>
              <CardDescription>
                Acesse o painel e os canais da sua marca utilizando o seu próprio domínio ou subdomínio.
              </CardDescription>
            </div>
            {domain && (
              <Badge
                variant={
                  domain.status === "active"
                    ? "default"
                    : domain.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
                className="capitalize"
              >
                {domain.status === "active" && (
                  <CheckCircle2Icon className="size-3 mr-1" />
                )}
                {domain.status === "active"
                  ? "Ativo (Verificado)"
                  : domain.status === "failed"
                    ? "Falha na verificação"
                    : "Pendente"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Seu Domínio ou Subdomínio</Label>
              <div className="flex gap-2">
                <Input
                  id="domain"
                  placeholder="ex: app.suaempresa.com.br"
                  {...form.register("domain")}
                  disabled={isUpserting || isVerifying || isDeleting}
                />
                <Button
                  type="submit"
                  disabled={isUpserting || isVerifying || isDeleting}
                >
                  {isUpserting ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
              {form.formState.errors.domain && (
                <p className="text-sm text-destructive font-medium">
                  {form.formState.errors.domain.message}
                </p>
              )}
            </div>

            {domain && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <h4 className="font-semibold text-sm">
                  Instruções de Configuração DNS:
                </h4>
                <p className="text-xs text-muted-foreground">
                  Acesse o painel do seu provedor de domínio (ex: Cloudflare, Registro.br, Hostinger, GoDaddy) e crie a seguinte entrada:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-background border">
                    <span className="text-muted-foreground block mb-0.5">Tipo:</span>
                    <span className="font-mono font-semibold">CNAME</span>
                  </div>
                  <div className="p-2.5 rounded bg-background border flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Nome / Host:</span>
                      <span className="font-mono font-semibold">{domain.domain}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => copyToClipboard(domain.domain)}
                    >
                      <CopyIcon className="size-3.5" />
                    </Button>
                  </div>
                  <div className="p-2.5 rounded bg-background border flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Destino / Valor:</span>
                      <span className="font-mono font-semibold">{cnameTarget}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => copyToClipboard(cnameTarget)}
                    >
                      <CopyIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  * A propagação DNS pode levar de alguns minutos até 24 horas dependendo do seu provedor.
                </p>
              </div>
            )}
          </CardContent>

          {domain && (
            <CardFooter className="flex justify-between border-t pt-4 bg-muted/10">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => executeDelete({ id: domain.id })}
                disabled={isDeleting || isVerifying || isUpserting}
              >
                {isDeleting ? (
                  <Loader2Icon className="size-4 animate-spin mr-1" />
                ) : (
                  <Trash2Icon className="size-4 mr-1" />
                )}
                Remover Domínio
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => executeVerify({ id: domain.id })}
                disabled={isDeleting || isVerifying || isUpserting}
              >
                {isVerifying ? (
                  <Loader2Icon className="size-4 animate-spin mr-1" />
                ) : (
                  <RefreshCwIcon className="size-4 mr-1" />
                )}
                Verificar Apontamento DNS
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  )
}
