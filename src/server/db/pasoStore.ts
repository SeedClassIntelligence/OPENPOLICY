import { randomUUID } from 'node:crypto';
import { postgresStore, PostgresStore, type SqlClient } from './postgresStore';
import type { PasoRole } from '../../domain/pasoAuthorization';

export interface SalesTeam { id:string; name:string; managerUserId?:string; activeStatus:'ACTIVE'|'INACTIVE'; createdAt:string; updatedAt:string }
export interface SalesTerritory { id:string; name:string; jurisdictionCodes:string[]; geographicScope:string; insuranceLineFocus:string[]; assignedTeamId?:string; effectiveFrom:string; effectiveTo?:string; createdAt:string; updatedAt:string }
export interface SalesRepProfile { id:string; internalUserId:string; teamId?:string; managerId?:string; role:PasoRole; employmentClassification:string; compensationPlanVersionId?:string; activeStatus:'ACTIVE'|'INACTIVE'|'SUSPENDED'; effectiveFrom:string; effectiveTo?:string; createdAt:string; updatedAt:string }

const id = (prefix:string) => `${prefix}-${randomUUID()}`;
const parse = (value:unknown):string[] => Array.isArray(value) ? value.map(String) : JSON.parse(String(value || '[]'));

export class PasoStore {
  constructor(private store:PostgresStore=postgresStore) {}
  private client():Promise<SqlClient>{ return this.store.getPgClient(); }

  async listTeams():Promise<SalesTeam[]>{ const c=await this.client(); const r=await c.query<any>('SELECT * FROM sales_teams ORDER BY name'); return r.rows.map(x=>({id:x.id,name:x.name,managerUserId:x.manager_user_id||undefined,activeStatus:x.active_status,createdAt:x.created_at,updatedAt:x.updated_at})); }
  async createTeam(input:{name:string;managerUserId?:string;actorId:string}):Promise<SalesTeam>{
    const name=input.name.trim(); if(!name)throw Object.assign(new Error('Team name is required.'),{statusCode:400});
    const now=new Date().toISOString(), team:SalesTeam={id:id('ST'),name,managerUserId:input.managerUserId?.trim()||undefined,activeStatus:'ACTIVE',createdAt:now,updatedAt:now};
    const c=await this.client(); await c.query('INSERT INTO sales_teams(id,name,manager_user_id,active_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)',[team.id,team.name,team.managerUserId||null,team.activeStatus,now,now]);
    await this.audit(c,input.actorId,'SALES_TEAM',team.id,'CREATED',undefined,JSON.stringify(team)); return team;
  }
  async listTerritories():Promise<SalesTerritory[]>{ const c=await this.client(); const r=await c.query<any>('SELECT * FROM sales_territories ORDER BY name'); return r.rows.map(x=>({id:x.id,name:x.name,jurisdictionCodes:parse(x.jurisdiction_codes),geographicScope:x.geographic_scope,insuranceLineFocus:parse(x.insurance_line_focus),assignedTeamId:x.assigned_team_id||undefined,effectiveFrom:x.effective_from,effectiveTo:x.effective_to||undefined,createdAt:x.created_at,updatedAt:x.updated_at})); }
  async createTerritory(input:{name:string;jurisdictionCodes:string[];geographicScope:string;insuranceLineFocus:string[];assignedTeamId?:string;effectiveFrom:string;effectiveTo?:string;actorId:string}):Promise<SalesTerritory>{
    if(!input.name.trim()||!input.effectiveFrom||!input.jurisdictionCodes.length)throw Object.assign(new Error('Territory name, effective date, and at least one jurisdiction are required.'),{statusCode:400});
    const now=new Date().toISOString(), territory:SalesTerritory={id:id('STR'),name:input.name.trim(),jurisdictionCodes:[...new Set(input.jurisdictionCodes.map(x=>x.toUpperCase()))],geographicScope:input.geographicScope.trim()||'STATE',insuranceLineFocus:[...new Set(input.insuranceLineFocus.map(x=>x.toUpperCase()))],assignedTeamId:input.assignedTeamId||undefined,effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo||undefined,createdAt:now,updatedAt:now};
    const c=await this.client(); await c.query('INSERT INTO sales_territories(id,name,jurisdiction_codes,geographic_scope,insurance_line_focus,assigned_team_id,effective_from,effective_to,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[territory.id,territory.name,JSON.stringify(territory.jurisdictionCodes),territory.geographicScope,JSON.stringify(territory.insuranceLineFocus),territory.assignedTeamId||null,territory.effectiveFrom,territory.effectiveTo||null,now,now]);
    await this.audit(c,input.actorId,'SALES_TERRITORY',territory.id,'CREATED',undefined,JSON.stringify(territory)); return territory;
  }
  async listProfiles():Promise<SalesRepProfile[]>{ const c=await this.client(); const r=await c.query<any>('SELECT * FROM sales_rep_profiles ORDER BY created_at'); return r.rows.map(x=>this.mapProfile(x)); }
  async getProfileByInternalUserId(internalUserId:string):Promise<SalesRepProfile|undefined>{ const c=await this.client(); const r=await c.query<any>('SELECT * FROM sales_rep_profiles WHERE internal_user_id=$1',[internalUserId]); return r.rows[0]?this.mapProfile(r.rows[0]):undefined; }
  async createProfile(input:{internalUserId:string;teamId?:string;managerId?:string;role:PasoRole;employmentClassification:string;activeStatus?:SalesRepProfile['activeStatus'];effectiveFrom:string;actorId:string}):Promise<SalesRepProfile>{
    if(!input.internalUserId.trim()||!input.effectiveFrom)throw Object.assign(new Error('Internal user and effective date are required.'),{statusCode:400});
    const now=new Date().toISOString(), profile:SalesRepProfile={id:id('SRP'),internalUserId:input.internalUserId.trim(),teamId:input.teamId||undefined,managerId:input.managerId||undefined,role:input.role,employmentClassification:input.employmentClassification.trim()||'UNSPECIFIED',activeStatus:input.activeStatus||'ACTIVE',effectiveFrom:input.effectiveFrom,createdAt:now,updatedAt:now};
    const c=await this.client(); await c.query('INSERT INTO sales_rep_profiles(id,internal_user_id,team_id,manager_id,role,employment_classification,active_status,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[profile.id,profile.internalUserId,profile.teamId||null,profile.managerId||null,profile.role,profile.employmentClassification,profile.activeStatus,profile.effectiveFrom,now,now]);
    await this.audit(c,input.actorId,'SALES_REP_PROFILE',profile.id,'CREATED',undefined,JSON.stringify(profile)); return profile;
  }
  private mapProfile(x:any):SalesRepProfile{return {id:x.id,internalUserId:x.internal_user_id,teamId:x.team_id||undefined,managerId:x.manager_id||undefined,role:x.role,employmentClassification:x.employment_classification,compensationPlanVersionId:x.compensation_plan_version_id||undefined,activeStatus:x.active_status,effectiveFrom:x.effective_from,effectiveTo:x.effective_to||undefined,createdAt:x.created_at,updatedAt:x.updated_at};}
  private async audit(c:SqlClient,actorId:string,objectType:string,objectId:string,action:string,prior?:string,result?:string){await c.query('INSERT INTO sales_audit_events(id,actor_id,object_type,object_id,action,prior_state_reference,resulting_state_reference,occurred_at,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id('SAE'),actorId,objectType,objectId,action,prior||null,result||null,new Date().toISOString(),id('COR')]);}
}

export const pasoStore=new PasoStore();
