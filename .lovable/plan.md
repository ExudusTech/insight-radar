## Plano

1. **Corrigir a causa provável do fallback “This page didn’t load” no dashboard**
   - Ajustar `src/routes/_authenticated/dashboard.tsx` para não chamar hooks de forma condicional.
   - Hoje o componente pode renderizar primeiro como usuário ainda carregando e chamar `useQuery(fetchKpis)`, depois renderizar como `contractor` e retornar `<ContractorDashboard />` antes desse hook. Isso causa erro de ordem de hooks em React e cai no fallback; ao clicar em “Try again”, o cache do usuário já está pronto e a página abre.

2. **Refatorar o dashboard em dois componentes seguros**
   - `Dashboard`: apenas lê `useCurrentUser()` e decide qual painel mostrar.
   - `StaffDashboard`: concentra KPIs e `useQuery(fetchKpis)` para superadmin/coordinator/analyst.
   - `ContractorDashboard`: permanece como está para usuários contractor.

3. **Adicionar estado intermediário leve**
   - Enquanto o perfil/role ainda carrega, mostrar um loader simples em vez de renderizar o dashboard administrativo por engano.

4. **Verificar o resultado**
   - Abrir `/dashboard` no preview e confirmar que não aparece mais o fallback.
   - Confirmar que o contractor continua indo para o dashboard de cliente e que os demais papéis continuam vendo KPIs.

## Detalhes técnicos

O bug é compatível com o padrão:

```tsx
const { data: user } = useCurrentUser();
if (user?.role === "contractor") return <ContractorDashboard />;
const { data: kpis } = useQuery(...);
```

Isso viola a regra de hooks quando `user.role` muda entre renders. A correção é mover o `useQuery` para um componente que só é montado no fluxo administrativo, mantendo a ordem de hooks estável em cada componente.