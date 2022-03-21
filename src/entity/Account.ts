import { Entity, Column } from "typeorm";
import { EntityBase } from "../lib/EntityBase";

export enum AccountType {
	UNVERIFIED	= 'unverified',
	VERIFIED	= 'verified',
	BANNED		= 'banned'
}

@Entity()
export class Account extends EntityBase {
	@Column({ unique: true })
	email: string;

	@Column()
    password: string;

	@Column('enum', {
		enum: AccountType,
		default: AccountType.UNVERIFIED
	})
	type: AccountType;

	@Column({ nullable: true })
	banReason: string;

	@Column({ nullable: true })
	socketId: string;

	toJSON(): Account {
		const obj: any = { ...this };
		return obj;
	}
}
