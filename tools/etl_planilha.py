import xlrd,re,json,collections,difflib,datetime
wb=xlrd.open_workbook('../data/Acompanhamento_de_Contratos.xls')
DM=wb.datemode
MESES={'jan':1,'fev':2,'mar':3,'mr':3,'abr':4,'aabr':4,'mai':5,'maio':5,'jun':6,'jin':6,'jul':7,'ju':7,'ago':8,'set':9,'st':9,'out':10,'ou':10,'nov':11,'dez':12,'des':12}
def iso(y,m,d):
    try: return datetime.date(y,m,d).isoformat()
    except: return None
def pdate(cell):
    """returns (iso or None, original text or None)"""
    t,v=cell.ctype,cell.value
    if t in (0,6) or (t==1 and not v.strip()): return None,None
    if t==3 or (t==2 and 20000<v<60000):
        try: return xlrd.xldate.xldate_as_datetime(v,DM).date().isoformat(),None
        except: return None,str(v)
    s=str(v).strip()
    m=re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\.?$',s)
    if m:
        d,mo,y=int(m[1]),int(m[2]),int(m[3]); y= y+2000 if y<100 else y
        r=iso(y,mo,d)
        if r: return r,None
    m=re.match(r'^([a-zç]+)[\.;/\-\s]*(\d{2})$',s.lower())
    if m and m[1].rstrip('.') in MESES:
        return iso(2000+int(m[2]),MESES[m[1].rstrip('.')],1),s
    return None,s
def pnum(cell):
    if cell.ctype==2: return cell.value,None
    s=str(cell.value).strip()
    return None,(s or None)
def clean(s):
    s=str(s).strip() if s is not None else ''
    s=re.sub(r'\s{2,}',' ',s)
    return s

g=wb.sheet_by_name('Geral')
FIX={'Insdustrial':'Industrial','Saude':'Saúde','Transm issão':'Transmissão','GEral':'Geral'}
regs=[]
for r in range(7,1066):
    c=g.row(r)
    num=int(c[1].value)
    di,dit=pdate(c[7]); de,det=pdate(c[8])
    val,valt=pnum(c[10]); venc,_=pnum(c[11])
    obs=clean(c[12].value) if c[12].ctype==1 else ''
    ent=''
    if obs in('Ltda','Coo'): ent={'Ltda':'Cooesa Ltda','Coo':'Cooperativa'}[obs]; obs=''
    tipo=clean(c[9].value).upper()
    ano=int(c[15].value) if c[15].ctype==2 else None
    tax=[FIX.get(clean(c[i].value),clean(c[i].value)) if c[i].ctype==1 else '' for i in (19,20,21,22,23)]
    sit=clean(c[6].value)
    regs.append(dict(num=num,empresa=clean(c[2].value).upper() if c[2].value else '',contato=clean(c[3].value) if c[3].ctype==1 else '',
        gerente=clean(c[4].value),escopo=clean(c[5].value),situacao=sit,
        dataIni=di,dataIniTexto=dit,dataEnc=de,dataEncTexto=det,tipo=tipo if tipo in('P','T') else '',
        valor=val,valorTexto=valt,valorVencedor=venc,entidade=ent,obs=obs,ano=ano,
        setor=tax[0],area=tax[1],empreendimento=tax[2],servico=tax[3],especialidade=tax[4],acompanhamentos=[]))
# normalize casing variants in taxonomy
for k in ['setor','area','empreendimento','servico','especialidade']:
    cnt=collections.Counter(r[k] for r in regs if r[k])
    best={}
    for v,n in cnt.most_common():
        key=re.sub(r'\s+','',v.lower())
        best.setdefault(key,v)
    for r in regs:
        if r[k]: r[k]=best[re.sub(r'\s+','',r[k].lower())]
# year of missing ano from date
for r in regs:
    if not r['ano'] and r['dataIni']: r['ano']=int(r['dataIni'][:4])
# fix situacao variants
for r in regs:
    s=r['situacao']
    if s.lower().startswith('proposta colocada - neg'): s='Proposta colocada - negativa'
    r['situacao']=s

# ---- year sheets -> acompanhamentos
def n6(x): return re.sub(r'[^a-z0-9]','',str(x).lower())
byNum={r['num']:r for r in regs}
unmatched=[]; matched=0
for name,keycol in [('2001',0),('2002',0),('2003',1),('2004',1),('2005',None),('2006',None)]:
    s=wb.sheet_by_name(name)
    hdr=[r for r in range(8) if 'EMPRESA' in [str(x) for x in s.row_values(r)]][0]
    h=[str(x).strip().upper() for x in s.row_values(hdr)]
    ie=h.index('EMPRESA'); isc=h.index('ESCOPO'); isit=h.index('SITUAÇÃO')
    iar=[i for i,x in enumerate(h) if x.startswith('A REC')][0]; iob=h.index('OBSERVAÇÕES')
    iv=h.index('VALOR')
    for rr in range(hdr+1,s.nrows):
        emp=clean(s.cell_value(rr,ie)); esc_=clean(s.cell_value(rr,isc))
        if not emp or not esc_: continue
        obs=clean(s.cell_value(rr,iob)) if s.cell_type(rr,iob)==1 else ''
        ar=s.cell_value(rr,iar); ar=ar if isinstance(ar,float) and ar>0 else None
        if not obs and not ar: continue
        target=None
        if keycol is not None:
            k=s.cell_value(rr,keycol)
            if isinstance(k,float) and int(k) in byNum and n6(byNum[int(k)]['empresa'])[:3]==n6(emp)[:3]: target=byNum[int(k)]
        if not target:
            cands=[x for x in regs if n6(x['empresa'])[:3]==n6(emp)[:3]]
            best=max(cands,key=lambda x:difflib.SequenceMatcher(None,n6(x['escopo']),n6(esc_)).ratio(),default=None)
            if best and difflib.SequenceMatcher(None,n6(best['escopo']),n6(esc_)).ratio()>0.6: target=best
        item=dict(fonte='Planilha '+name,situacaoNaEpoca=clean(s.cell_value(rr,isit)),obs=obs,aReceber=ar)
        if target: target['acompanhamentos'].append(item); matched+=1
        else: unmatched.append(dict(item,empresa=emp,escopo=esc_))

# ---- notas fiscais
notas=[]; totais={}; mensal={}
for name in ['NFs-Tributos 2020','NFs Tributos 2021','NFs Tributos 2022','NFs Tributos 2023','NFs Tributos 2024']:
    s=wb.sheet_by_name(name); ano=int(name[-4:])
    off=1 if ano==2020 else 0
    for rr in range(3,s.nrows):
        c=s.row(rr)
        titulo=clean(c[3+off].value) if c[3+off].ctype==1 else ''
        T=titulo.upper()
        if T.startswith(('FATURADO','FATURAMENTO ANUAL')): totais[ano]=c[4+off].value; break
        if T.startswith('DE JANEIRO'): continue
        if T.startswith('TOTAL'):
            mensal[(ano,T)]=c[4+off].value; continue
        if c[4+off].ctype!=2 or c[4+off].value<1: continue
        if not titulo and not clean(c[2+off].value) and ano==2020: continue
        emp=clean(c[2+off].value)
        de,_=pdate(c[1+off]); dc,_=pdate(c[5+off])
        m=re.search(r'NFe?[-\s]*0*(\d+)',titulo,re.I)
        coo=int(c[1].value) if ano==2020 and c[1].ctype==2 else None
        notas.append(dict(numero=m[1] if m else '',dataEmissao=de,dataCredito=dc,empresa=emp.upper(),titulo=titulo,valor=round(c[4+off].value,2),ano=ano,registroNum=coo,linha=rr+1,aba=name))
# ---- taxonomy tree
ct=wb.sheet_by_name('Critério de Pesquisa'); tree=[]; cur=None
for rr in range(4,ct.nrows):
    a,b,cc,d,e=[clean(ct.cell_value(rr,i)) for i in range(1,6)]
    if a: cur={'setor':a,'areas':[]}; tree.append(cur)
    if b and cur: cur['areas'].append({'area':b.replace('´',''),'empreendimentos':cc,'servicos':d,'especialidades':e})

json.dump(dict(registros=regs,notas=notas,taxonomia=tree,naoVinculados=unmatched),open('../data/dados_intermediarios.json','w'),ensure_ascii=False,indent=1)
# checks
C=collections.Counter(r['situacao'] for r in regs); print(C)
print('acomp matched',matched,'unmatched',len(unmatched))
print('notas',len(notas),{a:round(sum(n['valor'] for n in notas if n['ano']==a),2) for a in range(2020,2025)},'planilha',totais)
print('valor total',sum(r['valor'] or 0 for r in regs))
print('dataIni parsed',sum(1 for r in regs if r['dataIni']),'texto',[r['dataIniTexto'] for r in regs if r['dataIniTexto']])
print('dataEnc texto',[r['dataEncTexto'] for r in regs if r['dataEncTexto']])
print('clientes',len(set(r['empresa'] for r in regs)))
print(json.dumps(regs[5],ensure_ascii=False))
