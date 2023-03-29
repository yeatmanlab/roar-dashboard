<template>
	<article :id="gameId" :data-completed="completed" class="roar-game-list-item">
		<section class="list-item-status">
			<template v-if="completed">
				<i class="pi pi-arrow-circle-right"></i>
				<span>Completed!</span>
			</template>
			<template v-else>
				<i class="pi pi-clock"></i>
				<span>Not played yet</span>
			</template>
		</section>
		<div class="list-item-image">
			<img :src="imgSrc" />
		</div>
		<section class="list-item-content">
			<header class="list-item-meta">
				<Tag v-for="(items,index) in metadata" :value="items"></Tag>
			</header>
			<section class="list-item-body">
				<h2>{{title}}</h2>
				<div>{{description}}</div>
			</section>
			<footer class="list-item-footer">
				<router-link :to="{ path: 'game/' + gameId }">
					<Button :label="playLabel" icon="pi pi-sign-in" />
				</router-link>
			</footer>
		</section>
	</article>
</template>

<script setup>
	import {ref} from "vue";
	const props = defineProps({
		gameId: {type: String, required: true},
		title: {type:String, required: true},
		description: {type: String, required: true},
		metadata: {type: Object, default: {}},
		imgSrc: {type: String, default: ''},
		completed: {type: Boolean, default: false, required: true},
		statusText: {type: String, default: '', required: false}
	});
	const playLabel = ref((props.completed) ? 'Play again' : 'Play');
</script>

<style lang="scss">
	.roar-game-list-item {
		--borderRadius: 1.25rem;
		position: relative;
		display: flex;
		gap: 2rem;
		flex-direction: row;
		
		margin-block: 1rem;
		text-align: left;
		
		.list-item-status {
			order: 99;
			width: 100vw;
			max-width: 100px;
			text-align: center;
			display: inline-flex;
			justify-content: space-around;
			flex-direction: column;
			
			i {
				margin-top: auto;
				margin-bottom: 1rem;
				font-size: 2.5rem;
			}
			
			span {
				margin-bottom: auto;
			}
		}
		
		.list-item-image {
			width: 50vw;
			min-width: 100px;
			max-width: 500px;
			overflow: hidden;
			margin-bottom: auto;
			
			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				border-radius: var(--borderRadius);
			}
		}
		
		.list-item-content {
			width: 100%;
			display: inline-flex;
			flex-direction: column;
		}
		
		.list-item-meta {
			margin-bottom: 1rem;
			
			.p-tag {
				margin-right: .5rem;
				background: var(--surface-200);
				color: var(--surface-400);
			}
		}
		
		.list-item-body {
			padding: 1rem;
			background: var(--surface-50);
			border: 1px solid var(--surface-300);
			border-bottom: 0;
			border-top-left-radius: calc(var(--borderRadius) / 5);
			border-top-right-radius: calc(var(--borderRadius) / 5);

			h2 {
				margin: 0 0 1rem 0;
			}
			
			> div {
				margin-bottom: 1rem;
				padding-right: 2rem;
				max-width: 70ch;
			}
		}
		
		.list-item-footer {
			a, button {
				width: 100%;
				display: inline-block;
				border-top-left-radius: 0;
				border-top-right-radius: 0;
			}	
			
			a:before {
				content: " ";
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}
		
		}
	}
	
	// Completed games
	// All games after the current To Play game
	.roar-game-list-item[data-completed="true"],
	.roar-game-list-item[data-completed="true"] + .roar-game-list-item[data-completed="false"] ~ .roar-game-list-item[data-completed="false"] {
		opacity: 0.5;
		filter: grayscale(.75);
	}
	
	// Current TO PLAY game
	.roar-game-list-item[data-completed="true"] + .roar-game-list-item[data-completed="false"] {
		h2 {
			font-size: h1;
		}
	}
</style>